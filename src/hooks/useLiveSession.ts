import { useState, useEffect, useCallback, useRef } from 'react'
import { type RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase, getSupabaseAdmin, isSupabaseConfigured } from '../lib/supabase'
import type { Participant, Team } from '../types'
import { generateId } from './useTeamMatcher'

export interface LivePlayer {
  dbId: string
  name: string
  skill: number
  joinedAt: number
}

const LIVE_KEY_PREFIX = 'tm-live-active:'
const PULLED_KEY_PREFIX = 'tm-live-pulled-ids:'

export function useLiveSession(activeSessionName: string | null = null) {
  const [isActive, setIsActive] = useState(false)
  const [remotePlayers, setRemotePlayers] = useState<LivePlayer[]>([])
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pulledIdsRef = useRef<Set<string>>(new Set())

  const supabaseAvailable = isSupabaseConfigured()

  // sessionId IS the session name — no random codes
  const sessionId = isActive ? activeSessionName : null

  // Restore live state from localStorage when activeSessionName changes
  useEffect(() => {
    if (!supabaseAvailable || !activeSessionName) {
      setIsActive(false)
      setRemotePlayers([])
      pulledIdsRef.current = new Set()
      return
    }

    // Clean up previous realtime channel
    const supabase = getSupabase()
    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const wasLive = localStorage.getItem(`${LIVE_KEY_PREFIX}${activeSessionName}`) === 'true'
    if (wasLive) {
      setIsActive(true)
      setRemotePlayers([])

      // Ensure the :active marker exists (may be missing if session was started before this code)
      const sb = getSupabase()
      if (sb) {
        sb.from('session_teams').upsert({
          session_id: `${activeSessionName}:active`,
          teams_json: JSON.stringify({ active: true }),
          published_at: new Date().toISOString(),
        }).then(() => {})
      }

      try {
        const savedPulled = localStorage.getItem(`${PULLED_KEY_PREFIX}${activeSessionName}`)
        if (savedPulled) {
          pulledIdsRef.current = new Set(JSON.parse(savedPulled))
        } else {
          pulledIdsRef.current = new Set()
        }
      } catch {
        pulledIdsRef.current = new Set()
      }
    } else {
      setIsActive(false)
      setRemotePlayers([])
      pulledIdsRef.current = new Set()
    }
  }, [supabaseAvailable, activeSessionName])

  // Fetch all players for this session
  const fetchPlayers = useCallback(async (sid: string) => {
    const supabase = getSupabase()
    if (!supabase) return

    const { data, error: fetchError } = await supabase
      .from('live_players')
      .select('*')
      .eq('session_id', sid)

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    if (data) {
      setRemotePlayers(
        data.map(row => ({
          dbId: row.id,
          name: row.name,
          skill: row.skill,
          joinedAt: new Date(row.joined_at).getTime(),
        })),
      )
    }
  }, [])

  // Attach realtime listener + polling fallback when session is active
  useEffect(() => {
    if (!isActive || !activeSessionName) return

    const supabase = getSupabase()
    if (!supabase) return

    fetchPlayers(activeSessionName)

    const channel = supabase
      .channel(`session-${activeSessionName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_players',
          filter: `session_id=eq.${activeSessionName}`,
        },
        payload => {
          setRemotePlayers(prev => {
            if (prev.some(p => p.dbId === payload.new.id)) {
              return prev
            }
            return [
              ...prev,
              {
                dbId: payload.new.id,
                name: payload.new.name,
                skill: payload.new.skill,
                joinedAt: new Date(payload.new.joined_at).getTime(),
              },
            ]
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_players',
          filter: `session_id=eq.${activeSessionName}`,
        },
        () => {
          fetchPlayers(activeSessionName)
        },
      )
      .subscribe()

    channelRef.current = channel

    const poll = setInterval(() => fetchPlayers(activeSessionName), 3000)

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      clearInterval(poll)
    }
  }, [isActive, activeSessionName, fetchPlayers])

  const startSession = useCallback(() => {
    if (!activeSessionName) {
      setError('Save the session with a name before going live')
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase not configured')
      return
    }

    setIsActive(true)
    setRemotePlayers([])
    setError(null)
    pulledIdsRef.current = new Set()
    localStorage.setItem(`${LIVE_KEY_PREFIX}${activeSessionName}`, 'true')
    localStorage.removeItem(`${PULLED_KEY_PREFIX}${activeSessionName}`)

    // Write a marker so the join page knows this session exists
    supabase.from('session_teams').upsert({
      session_id: `${activeSessionName}:active`,
      teams_json: JSON.stringify({ active: true }),
      published_at: new Date().toISOString(),
    }).then(() => {})
  }, [activeSessionName])

  const stopSession = useCallback(async () => {
    const supabase = getSupabase()
    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setIsActive(false)
    if (activeSessionName) {
      localStorage.removeItem(`${LIVE_KEY_PREFIX}${activeSessionName}`)
      localStorage.removeItem(`${PULLED_KEY_PREFIX}${activeSessionName}`)

      // Clean up DB records so join links stop working (use admin client to bypass RLS)
      const admin = getSupabaseAdmin()
      if (admin) {
        await Promise.allSettled([
          admin.from('live_players').delete().eq('session_id', activeSessionName),
          admin.from('session_teams').delete().eq('session_id', activeSessionName),
          admin.from('session_teams').delete().eq('session_id', `${activeSessionName}:kicks`),
          admin.from('session_teams').delete().eq('session_id', `${activeSessionName}:active`),
        ])
      }
    }
    pulledIdsRef.current = new Set()
  }, [activeSessionName])

  const unpulledPlayers = remotePlayers.filter(
    rp => !pulledIdsRef.current.has(rp.dbId),
  )

  const pullRemotePlayers = useCallback((): Participant[] => {
    const toPull = remotePlayers.filter(
      rp => !pulledIdsRef.current.has(rp.dbId),
    )
    const pulled = toPull.map(rp => ({
      id: generateId(),
      name: rp.name,
      skill: rp.skill,
      excluded: false,
      lockedTeam: null,
      lockSource: null,
    }))
    for (const rp of toPull) {
      pulledIdsRef.current.add(rp.dbId)
    }
    if (activeSessionName) {
      localStorage.setItem(`${PULLED_KEY_PREFIX}${activeSessionName}`, JSON.stringify([...pulledIdsRef.current]))
    }
    return pulled
  }, [remotePlayers, activeSessionName])

  const publishTeams = useCallback(async (teams: Team[]) => {
    const supabase = getSupabase()
    if (!supabase || !activeSessionName) return false

    const teamsData = teams.map(t => ({
      name: t.name,
      members: t.members.map(m => m.name),
    }))

    const { error: upsertError } = await supabase
      .from('session_teams')
      .upsert({
        session_id: activeSessionName,
        teams_json: JSON.stringify(teamsData),
        published_at: new Date().toISOString(),
      })

    return !upsertError
  }, [activeSessionName])

  const kickPlayer = useCallback(async (playerName: string) => {
    const supabase = getSupabase()
    if (!supabase || !activeSessionName) return

    // Primary: write kick signal to session_teams (upsert is proven to work)
    const kickKey = `${activeSessionName}:kicks`
    const { data: existing } = await supabase
      .from('session_teams')
      .select('teams_json')
      .eq('session_id', kickKey)
      .single()

    const kicked: string[] = existing?.teams_json
      ? JSON.parse(existing.teams_json)
      : []
    if (!kicked.some(k => k.toLowerCase() === playerName.toLowerCase())) {
      kicked.push(playerName)
    }

    await supabase.from('session_teams').upsert({
      session_id: kickKey,
      teams_json: JSON.stringify(kicked),
      published_at: new Date().toISOString(),
    })

    // Best-effort: also try DB delete
    supabase
      .from('live_players')
      .delete()
      .eq('session_id', activeSessionName)
      .eq('name', playerName)
      .then(() => {})
  }, [activeSessionName])

  return {
    supabaseAvailable,
    isActive,
    sessionId,
    remotePlayers: unpulledPlayers,
    allRemotePlayers: remotePlayers,
    error,
    startSession,
    stopSession,
    pullRemotePlayers,
    publishTeams,
    kickPlayer,
  }
}
