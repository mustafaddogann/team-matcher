import { useCallback, useMemo, useEffect, useRef } from 'react'
import type { Participant, Team, BalancerConfig, SessionData } from '../types'
import { balanceTeams } from '../algorithms/balancer'
import { getRandomTeamNames } from '../data/teamNames'
import { validateParticipants } from '../utils/validation'
import { useLocalStorage } from './useLocalStorage'

let nextId = 1
export function generateId(): string {
  return `p-${nextId++}-${Date.now()}`
}

function createEmptyParticipant(): Participant {
  return {
    id: generateId(),
    name: '',
    skill: 0,
    excluded: false,
    lockedTeam: null,
  }
}

const DEFAULT_CONFIG: BalancerConfig = {
  teamCount: 2,
  nameLanguage: 'en',
}

export function useTeamMatcher() {
  const [participants, setParticipants] = useLocalStorage<Participant[]>(
    'tm-participants',
    [createEmptyParticipant()],
  )
  const [config, setConfig] = useLocalStorage<BalancerConfig>('tm-config', DEFAULT_CONFIG)
  const [teams, setTeams] = useLocalStorage<Team[]>('tm-teams', [])
  const [autoTeams, setAutoTeams] = useLocalStorage<Team[]>('tm-auto-teams', [])
  const [activeSessionName, setActiveSessionName] = useLocalStorage<string | null>('tm-active-session', null)
  const skipAutoSaveRef = useRef(false)

  const validationErrors = useMemo(
    () => validateParticipants(participants, config),
    [participants, config],
  )

  const addParticipant = useCallback(() => {
    setParticipants(prev => [...prev, createEmptyParticipant()])
  }, [setParticipants])

  const updateParticipant = useCallback(
    (id: string, updates: Partial<Participant>) => {
      setParticipants(prev =>
        prev.map(p => (p.id === id ? { ...p, ...updates } : p)),
      )
    },
    [setParticipants],
  )

  const removeParticipant = useCallback(
    (id: string) => {
      setParticipants(prev => {
        const next = prev.filter(p => p.id !== id)
        return next.length === 0 ? [createEmptyParticipant()] : next
      })
      setTeams(prev => prev.map(t => ({ ...t, members: t.members.filter(m => m.id !== id) })))
      setAutoTeams(prev => prev.map(t => ({ ...t, members: t.members.filter(m => m.id !== id) })))
    },
    [setParticipants, setTeams, setAutoTeams],
  )

  const bulkSetParticipants = useCallback(
    (newParticipants: Participant[]) => {
      setParticipants(newParticipants.length > 0 ? newParticipants : [createEmptyParticipant()])
    },
    [setParticipants],
  )

  const updateConfig = useCallback(
    (updates: Partial<BalancerConfig>) => {
      setConfig(prev => ({ ...prev, ...updates }))
    },
    [setConfig],
  )

  const generateTeams = useCallback(() => {
    const activeParticipants = participants.filter(
      p => p.name.trim() && !isNaN(p.skill) && !p.excluded,
    )
    if (activeParticipants.length < config.teamCount) return

    const result = balanceTeams(activeParticipants, config)

    // Preserve existing team names on regeneration
    if (teams.length > 0) {
      for (const t of result) {
        const prev = teams.find(pt => pt.index === t.index)
        if (prev) t.name = prev.name
      }
    }

    // Auto-lock all assigned participants to their teams
    const lockMap = new Map<string, number>()
    for (const team of result) {
      for (const member of team.members) {
        lockMap.set(member.id, team.index)
      }
    }
    setParticipants(prev =>
      prev.map(p => lockMap.has(p.id) ? { ...p, lockedTeam: lockMap.get(p.id)! } : p),
    )

    setTeams(result)
    setAutoTeams(result.map(t => ({ ...t, members: [...t.members] })))
  }, [participants, config, teams])

  const renameTeam = useCallback(
    (teamIndex: number, newName: string) => {
      setTeams(prev =>
        prev.map(t => (t.index === teamIndex ? { ...t, name: newName } : t)),
      )
    },
    [],
  )

  const shuffleTeamNames = useCallback(() => {
    const names = getRandomTeamNames(config.nameLanguage ?? 'en', teams.length)
    setTeams(prev => prev.map((t, i) => ({ ...t, name: names[i] })))
  }, [config.nameLanguage, teams.length])

  const moveParticipant = useCallback(
    (participantId: string, fromTeamIndex: number, toTeamIndex: number) => {
      setTeams(prev => {
        const next = prev.map(t => ({ ...t, members: [...t.members] }))
        const fromTeam = next.find(t => t.index === fromTeamIndex)
        const toTeam = next.find(t => t.index === toTeamIndex)
        if (!fromTeam || !toTeam) return prev

        const memberIdx = fromTeam.members.findIndex(m => m.id === participantId)
        if (memberIdx === -1) return prev

        const [member] = fromTeam.members.splice(memberIdx, 1)
        toTeam.members.push(member)
        return next
      })
    },
    [],
  )

  const resetToAuto = useCallback(() => {
    setTeams(autoTeams.map(t => ({ ...t, members: [...t.members] })))
  }, [autoTeams])

  const clearAll = useCallback(() => {
    setParticipants([createEmptyParticipant()])
    setConfig(DEFAULT_CONFIG)
    setTeams([])
    setAutoTeams([])
  }, [setParticipants, setConfig])

  // Auto-save to active named session whenever data changes
  useEffect(() => {
    if (!activeSessionName || skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false
      return
    }
    const data: SessionData = {
      participants,
      config,
      teams,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(`tm-session-${activeSessionName}`, JSON.stringify(data))
  }, [participants, config, teams, activeSessionName])

  const saveSession = useCallback(
    (name: string) => {
      const data: SessionData = {
        participants,
        config,
        teams,
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem(`tm-session-${name}`, JSON.stringify(data))
      setActiveSessionName(name)
    },
    [participants, config, teams],
  )

  const loadSession = useCallback(
    (name: string) => {
      const raw = localStorage.getItem(`tm-session-${name}`)
      if (!raw) return false
      try {
        const data = JSON.parse(raw) as SessionData
        skipAutoSaveRef.current = true
        setParticipants(data.participants)
        setConfig(data.config)
        setTeams(data.teams)
        setAutoTeams(data.teams.map(t => ({ ...t, members: [...t.members] })))
        setActiveSessionName(name)
        return true
      } catch {
        return false
      }
    },
    [setParticipants, setConfig],
  )

  const newSession = useCallback((name: string) => {
    skipAutoSaveRef.current = true
    setParticipants([createEmptyParticipant()])
    setConfig(DEFAULT_CONFIG)
    setTeams([])
    setAutoTeams([])
    setActiveSessionName(name)
    // Save the empty session immediately
    const data: SessionData = {
      participants: [createEmptyParticipant()],
      config: DEFAULT_CONFIG,
      teams: [],
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(`tm-session-${name}`, JSON.stringify(data))
  }, [setParticipants, setConfig])

  const deleteSession = useCallback((name: string) => {
    localStorage.removeItem(`tm-session-${name}`)
    if (activeSessionName === name) {
      setActiveSessionName(null)
    }
  }, [activeSessionName])

  const getSavedSessions = useCallback((): string[] => {
    const sessions: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('tm-session-')) {
        sessions.push(key.replace('tm-session-', ''))
      }
    }
    return sessions.sort()
  }, [])

  const hasValidParticipants = useMemo(() => {
    const active = participants.filter(p => p.name.trim() && !isNaN(p.skill) && !p.excluded)
    return active.length >= config.teamCount
  }, [participants, config])

  return {
    // State
    participants,
    config,
    teams,
    autoTeams,
    validationErrors,
    hasValidParticipants,
    activeSessionName,

    // Actions
    addParticipant,
    updateParticipant,
    removeParticipant,
    setParticipants: bulkSetParticipants,
    updateConfig,
    generateTeams,
    renameTeam,
    shuffleTeamNames,
    moveParticipant,
    setTeams,
    resetToAuto,
    clearAll,
    saveSession,
    loadSession,
    getSavedSessions,
    newSession,
    deleteSession,
  }
}
