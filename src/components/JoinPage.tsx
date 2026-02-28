import { useState, useEffect, useRef } from 'react'
import { getSupabase } from '../lib/supabase'
import TeamChat from './TeamChat'
import VoiceBar from './VoiceBar'

interface JoinPageProps {
  sessionId: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error' | 'editing' | 'kicked'

const JOINED_KEY_PREFIX = 'tm-joined-'
const TEAM_KEY_PREFIX = 'tm-team-'
const TEAMS_KEY_PREFIX = 'tm-teams-data-'
const CHANNEL_KEY_PREFIX = 'tm-channel-'
const LEGACY_VOICE_CHANNEL_KEY_PREFIX = 'tm-voice-channel-'

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function isChannelValid(channel: string, teamName: string | null): boolean {
  return channel === '__lobby__' || (!!teamName && channel === teamName)
}

export default function JoinPage({ sessionId }: JoinPageProps) {
  const savedName = localStorage.getItem(`${JOINED_KEY_PREFIX}${sessionId}`)
  const [name, setName] = useState(savedName || '')
  const [skill, setSkill] = useState(5)
  const [status, setStatus] = useState<Status>(savedName ? 'success' : 'idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [teamName, setTeamName] = useState<string | null>(
    () => localStorage.getItem(`${TEAM_KEY_PREFIX}${sessionId}`),
  )
  const [allTeams, setAllTeams] = useState<Record<string, string[]>>(
    () => loadJson(`${TEAMS_KEY_PREFIX}${sessionId}`, {}),
  )
  const [activeChannel, setActiveChannel] = useState<string>(
    () => localStorage.getItem(`${CHANNEL_KEY_PREFIX}${sessionId}`) || '__lobby__',
  )
  const [allTeamsOpen, setAllTeamsOpen] = useState(false)
  const [originalName, setOriginalName] = useState(savedName || '')
  const kickMissCount = useRef(0)

  useEffect(() => {
    if (teamName) {
      localStorage.setItem(`${TEAM_KEY_PREFIX}${sessionId}`, teamName)
    } else {
      localStorage.removeItem(`${TEAM_KEY_PREFIX}${sessionId}`)
    }
  }, [teamName, sessionId])

  useEffect(() => {
    if (Object.keys(allTeams).length > 0) {
      localStorage.setItem(`${TEAMS_KEY_PREFIX}${sessionId}`, JSON.stringify(allTeams))
    } else {
      localStorage.removeItem(`${TEAMS_KEY_PREFIX}${sessionId}`)
    }
  }, [allTeams, sessionId])

  useEffect(() => {
    if (isChannelValid(activeChannel, teamName)) {
      localStorage.setItem(`${CHANNEL_KEY_PREFIX}${sessionId}`, activeChannel)
      return
    }

    setActiveChannel('__lobby__')
  }, [activeChannel, teamName, sessionId])

  useEffect(() => {
    if (!savedName) return

    const supabase = getSupabase()
    if (!supabase) return

    supabase
      .from('live_players')
      .select('skill')
      .eq('session_id', sessionId)
      .eq('name', savedName)
      .single()
      .then(({ data }) => {
        if (data) setSkill(data.skill)
      })
  }, [savedName, sessionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setStatus('submitting')
    setErrorMsg('')

    const isUpdate = status === 'editing' || !!originalName

    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Session unavailable')

      const isNameTaken = async (checkName: string): Promise<boolean> => {
        const { data: existing } = await supabase
          .from('live_players')
          .select('id')
          .eq('session_id', sessionId)
          .eq('name', checkName)
          .limit(1)

        if (!existing || existing.length === 0) return false

        const kickKey = `${sessionId}:kicks`
        const { data: kickData } = await supabase
          .from('session_teams')
          .select('teams_json')
          .eq('session_id', kickKey)
          .single()

        if (kickData?.teams_json) {
          const kicked: string[] = JSON.parse(kickData.teams_json)
          if (kicked.some(k => k.toLowerCase() === checkName.toLowerCase())) {
            await supabase
              .from('live_players')
              .delete()
              .eq('session_id', sessionId)
              .eq('name', checkName)
            return false
          }
        }

        return true
      }

      if (isUpdate && originalName) {
        const newName = name.trim()
        const nameChanged = newName.toLowerCase() !== originalName.toLowerCase()

        if (nameChanged && await isNameTaken(newName)) {
          setErrorMsg('That name is already taken. Try a different one.')
          setStatus('editing')
          return
        }

        const { error } = await supabase
          .from('live_players')
          .update({ name: newName, skill })
          .eq('session_id', sessionId)
          .eq('name', originalName)

        if (error) throw error

        setOriginalName(newName)
        localStorage.setItem(`${JOINED_KEY_PREFIX}${sessionId}`, newName)
      } else {
        const { data: existing } = await supabase
          .from('live_players')
          .select('id, skill')
          .eq('session_id', sessionId)
          .eq('name', name.trim())
          .limit(1)

        if (existing && existing.length > 0) {
          await supabase
            .from('live_players')
            .update({ skill })
            .eq('session_id', sessionId)
            .eq('name', name.trim())
        } else {
          const { error } = await supabase.from('live_players').insert({
            session_id: sessionId,
            name: name.trim(),
            skill,
          })
          if (error) throw error
        }

        setOriginalName(name.trim())
        localStorage.setItem(`${JOINED_KEY_PREFIX}${sessionId}`, name.trim())
      }

      try {
        const kickKey = `${sessionId}:kicks`
        const { data: kickData } = await supabase
          .from('session_teams')
          .select('teams_json')
          .eq('session_id', kickKey)
          .single()

        if (kickData?.teams_json) {
          const kicked: string[] = JSON.parse(kickData.teams_json)
          const updated = kicked.filter(k => k.toLowerCase() !== name.trim().toLowerCase())
          await supabase.from('session_teams').upsert({
            session_id: kickKey,
            teams_json: JSON.stringify(updated),
            published_at: new Date().toISOString(),
          })
        }
      } catch {
        // Best effort
      }

      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save')
      setStatus(isUpdate ? 'editing' : 'error')
    }
  }

  const handleEdit = () => {
    setStatus('editing')
    setErrorMsg('')
  }

  const handleLeave = () => {
    localStorage.removeItem(`${JOINED_KEY_PREFIX}${sessionId}`)
    localStorage.removeItem(`${TEAM_KEY_PREFIX}${sessionId}`)
    localStorage.removeItem(`${TEAMS_KEY_PREFIX}${sessionId}`)
    localStorage.removeItem(`${CHANNEL_KEY_PREFIX}${sessionId}`)
    localStorage.removeItem(`${LEGACY_VOICE_CHANNEL_KEY_PREFIX}${sessionId}`)

    setStatus('idle')
    setName('')
    setSkill(5)
    setOriginalName('')
    setTeamName(null)
    setAllTeams({})
    setActiveChannel('__lobby__')
    setAllTeamsOpen(false)
  }

  useEffect(() => {
    if (status !== 'success') return

    const supabase = getSupabase()
    if (!supabase) return

    kickMissCount.current = 0

    const handleKick = () => {
      localStorage.removeItem(`${JOINED_KEY_PREFIX}${sessionId}`)
      localStorage.removeItem(`${TEAM_KEY_PREFIX}${sessionId}`)
      localStorage.removeItem(`${TEAMS_KEY_PREFIX}${sessionId}`)
      localStorage.removeItem(`${CHANNEL_KEY_PREFIX}${sessionId}`)
      localStorage.removeItem(`${LEGACY_VOICE_CHANNEL_KEY_PREFIX}${sessionId}`)

      setStatus('kicked')
      setOriginalName('')
      setTeamName(null)
      setAllTeams({})
      setActiveChannel('__lobby__')
      setAllTeamsOpen(false)
    }

    const checkKicked = async () => {
      try {
        const { data } = await supabase
          .from('session_teams')
          .select('teams_json')
          .eq('session_id', `${sessionId}:kicks`)
          .single()

        if (data?.teams_json) {
          const kicked: string[] = JSON.parse(data.teams_json)
          if (kicked.some(k => k.toLowerCase() === name.trim().toLowerCase())) {
            handleKick()
            return
          }
        }
      } catch {
        // no kick record
      }

      try {
        const { data } = await supabase
          .from('live_players')
          .select('id')
          .eq('session_id', sessionId)
          .eq('name', name.trim())
          .limit(1)

        if (!data || data.length === 0) {
          kickMissCount.current += 1
          if (kickMissCount.current >= 3) {
            handleKick()
          }
        } else {
          kickMissCount.current = 0
        }
      } catch {
        // network error
      }
    }

    const initialDelay = setTimeout(() => {
      void checkKicked()
    }, 3000)
    const poll = setInterval(() => {
      void checkKicked()
    }, 2000)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(poll)
    }
  }, [status, sessionId, name])

  useEffect(() => {
    if (status !== 'success') return

    const supabase = getSupabase()
    if (!supabase) return

    const check = async () => {
      const { data } = await supabase
        .from('session_teams')
        .select('teams_json')
        .eq('session_id', sessionId)
        .single()

      if (!data?.teams_json) {
        setTeamName(null)
        return
      }

      try {
        const teams: { name: string; members: string[] }[] = JSON.parse(data.teams_json)
        const grouped: Record<string, string[]> = {}
        let myTeam: string | null = null

        for (const team of teams) {
          grouped[team.name] = team.members
          if (team.members.some(m => m.toLowerCase() === name.trim().toLowerCase())) {
            myTeam = team.name
          }
        }

        setAllTeams(grouped)
        setTeamName(myTeam)
      } catch {
        // Invalid JSON
      }
    }

    void check()
    const poll = setInterval(() => {
      void check()
    }, 2000)

    return () => clearInterval(poll)
  }, [status, sessionId, name])

  const isEditing = status === 'editing'
  const teamMembers = teamName ? (allTeams[teamName] ?? [name.trim()]) : []
  const teamEntries = Object.entries(allTeams).sort(([left], [right]) => {
    if (left === teamName) return -1
    if (right === teamName) return 1
    return left.localeCompare(right)
  })
  const displayTeamLabel = teamName && teamName.length <= 16 ? teamName : 'Team'
  const activeChannelLabel = activeChannel === '__lobby__' ? 'Lobby' : (displayTeamLabel || 'Team')
  const activeChannelDetail = activeChannel === '__lobby__'
    ? 'Everyone in the session'
    : (teamName || 'Your team only')

  const renderHeader = (showWaiting: boolean) => (
    <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-lg ${
            teamName
              ? 'bg-gradient-to-br from-[#FF385C] to-[#D70466] shadow-[#FF385C]/20'
              : 'bg-gradient-to-br from-[#00A699] to-[#00867A] shadow-[#00A699]/20'
          }`}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30">
              {showWaiting ? 'Lobby Ready' : 'Player'}
            </p>
            <h1 className="truncate text-xl font-extrabold text-white">{name}</h1>
            <p className="mt-1 text-sm text-white/35">
              Skill {skill} &middot; {sessionId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleEdit}
            className="rounded-xl p-2.5 text-white/30 transition-all hover:bg-white/5 hover:text-white/70"
            title="Edit name or skill"
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={handleLeave}
            className="rounded-xl p-2.5 text-white/30 transition-all hover:bg-rausch/10 hover:text-rausch"
            title="Leave session"
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-white/65">
          Channel: {activeChannelLabel}
        </span>
        <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[12px] text-white/35">
          {activeChannelDetail}
        </span>
        {showWaiting && (
          <span className="rounded-full bg-babu/12 px-3 py-1 text-[12px] font-medium text-babu">
            Waiting for team assignment
          </span>
        )}
      </div>
    </div>
  )

  const renderAllTeamsCard = () => {
    if (!teamName || teamEntries.length === 0) return null

    return (
      <div className="mt-4 rounded-[24px] border border-white/[0.1] bg-white/[0.05] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <button
          onClick={() => setAllTeamsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF385C]/90 to-[#D70466]/85 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(215,4,102,0.28)]">
                AT
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-white">
                  All Teams
                </p>
                <p className="mt-0.5 truncate text-sm text-white/68">
                  Your team: {teamName} · {teamMembers.length} players
                </p>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-white/48">
              {teamEntries.length} teams, {teamEntries.reduce((sum, [, members]) => sum + members.length, 0)} players
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-white/75">
              {allTeamsOpen ? 'Hide' : 'Show'}
            </span>
            <svg
              className={`h-4 w-4 text-white/70 transition-transform ${allTeamsOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {allTeamsOpen && (
          <div className="tm-all-teams-panel mt-4 max-h-[28dvh] space-y-3 overflow-y-auto pr-1">
            {teamEntries.map(([team, members]) => {
              const isMyTeam = team === teamName
              return (
                <div
                  key={team}
                  className={`rounded-2xl border p-3 ${
                    isMyTeam
                      ? 'border-[#FF385C]/18 bg-[#FF385C]/10'
                      : 'border-white/[0.06] bg-white/[0.03]'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${isMyTeam ? 'text-white' : 'text-white/78'}`}>
                        {team}
                      </p>
                      <p className="text-[11px] text-white/35">
                        {members.length} player{members.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {isMyTeam && (
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
                        Your Team
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {members.map((member) => {
                      const isMe = member.toLowerCase() === name.trim().toLowerCase()
                      return (
                        <span
                          key={member}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                            isMe
                              ? 'border-white/15 bg-white/12 text-white'
                              : 'border-white/[0.08] bg-white/[0.05] text-white/65'
                          }`}
                        >
                          {member}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderChannelSwitcher = () => {
    if (!teamName) return null

    const options = [
      { key: '__lobby__', label: 'Lobby' },
      { key: teamName, label: displayTeamLabel || 'Team' },
    ]

    return (
      <div className="mt-4 inline-flex w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1">
        {options.map((option) => {
          const active = activeChannel === option.key
          return (
            <button
              key={option.key}
              onClick={() => setActiveChannel(option.key)}
              className={`flex-1 rounded-[14px] px-4 py-3 text-sm font-semibold transition-all ${
                active
                  ? 'bg-white text-[#0f0f23] shadow-[0_10px_30px_rgba(255,255,255,0.12)]'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  const renderChatSurface = () => (
    <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b1226]/70 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/25">
          Current Channel
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">{activeChannelLabel}</p>
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/40">
            {activeChannelDetail}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <TeamChat
          sessionId={sessionId}
          channel={activeChannel}
          channelLabel={activeChannelLabel}
          playerName={name.trim()}
        />
      </div>
    </div>
  )

  if (status === 'success') {
    return (
      <div className="tm-app-bg flex h-[100dvh] overflow-hidden">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[30%] left-[8%] h-[50%] w-[50%] rounded-full bg-[#FF385C]/[0.05] blur-[100px]" />
          <div className="absolute -bottom-[20%] right-[5%] h-[45%] w-[45%] rounded-full bg-[#00A699]/[0.04] blur-[110px]" />
        </div>

        <div className="relative z-10 mx-auto flex h-[100dvh] w-full max-w-5xl min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-5 sm:px-6 lg:px-8">
          {renderHeader(!teamName)}
          {renderAllTeamsCard()}
          {renderChannelSwitcher()}
          {renderChatSurface()}
          <VoiceBar
            sessionId={sessionId}
            channel={activeChannel}
            channelLabel={activeChannelLabel}
            playerName={name.trim()}
          />
        </div>
      </div>
    )
  }

  if (status === 'kicked') {
    return (
      <div className="tm-app-bg min-h-screen flex items-center justify-center p-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[#FF385C]/[0.04] blur-[100px]" />
        </div>
        <div className="relative z-10 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-8 max-w-sm w-full text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rausch/15 border border-rausch/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-rausch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2">Removed from Session</h1>
          <p className="text-white/40 mb-6">
            The host removed you from this session.
          </p>
          <button
            onClick={() => {
              setName('')
              setSkill(5)
              setStatus('idle')
            }}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF385C] to-[#D70466] hover:shadow-lg hover:shadow-rausch/20 active:scale-[0.97] transition-all"
          >
            Rejoin
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="tm-app-bg min-h-screen flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[30%] left-[10%] w-[50%] h-[50%] rounded-full bg-[#FF385C]/[0.04] blur-[100px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#00A699]/[0.03] blur-[80px]" />
      </div>

      <div className="relative z-10 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-7 max-w-sm w-full animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF385C] to-[#D70466] flex items-center justify-center flex-shrink-0 shadow-lg shadow-rausch/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-white leading-tight truncate">
              {isEditing ? 'Update Info' : sessionId}
            </h1>
            <p className="text-[12px] text-white/30">
              {isEditing ? 'Edit your details below' : 'Team matching session'}
            </p>
          </div>
        </div>

        {!isEditing && (
          <p className="text-[13px] text-white/40 mb-6 leading-relaxed">
            Enter your nickname and rate your skill level so the host can build balanced teams.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[13px] font-semibold text-white/60 mb-1.5">
              Nickname
            </label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (status === 'error') setStatus('idle')
              }}
              required
              autoFocus
              placeholder="What should we call you?"
              className="block w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-white text-lg placeholder-white/20 focus:border-white/20 focus:ring-0 focus:outline-none focus:bg-white/[0.07] transition-all"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-white/60 mb-1">
              Skill Level
            </label>
            <p className="text-[11px] text-white/25 mb-3">1 = beginner, 10 = expert</p>
            <div className="flex gap-1.5 justify-between">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSkill(n)}
                  className={`w-9 h-9 rounded-full text-sm font-bold transition-all duration-150 ${
                    skill === n
                      ? 'bg-gradient-to-br from-[#FF385C] to-[#D70466] text-white scale-110 shadow-lg shadow-rausch/25'
                      : 'bg-white/[0.06] text-white/40 hover:bg-white/[0.1] hover:text-white/60 border border-white/[0.04]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {(status === 'error' || (status === 'editing' && errorMsg)) && (
            <p className="text-sm text-rausch font-medium">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={!name.trim() || status === 'submitting'}
            className="w-full py-3.5 rounded-xl font-bold text-[15px] text-white bg-gradient-to-r from-[#FF385C] to-[#D70466] hover:shadow-lg hover:shadow-rausch/25 hover:translate-y-[-1px] active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {status === 'submitting' ? 'Joining...' : isEditing ? 'Save Changes' : 'Join Game'}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setStatus('success')
                setName(originalName)
                setErrorMsg('')
              }}
              className="w-full text-sm text-white/30 hover:text-white/60 font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
