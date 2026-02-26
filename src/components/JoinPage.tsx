import { useState, useEffect, useRef } from 'react'
import { getSupabase } from '../lib/supabase'
import BackgroundWidgets from './BackgroundWidgets'
import TeamChat from './TeamChat'
import VoiceBar from './VoiceBar'

interface JoinPageProps {
  sessionId: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error' | 'editing' | 'kicked'
type Tab = 'teams' | 'chat'

const JOINED_KEY_PREFIX = 'tm-joined-'
const TEAM_KEY_PREFIX = 'tm-team-'
const TEAMS_KEY_PREFIX = 'tm-teams-data-'
const CHANNEL_KEY_PREFIX = 'tm-channel-'

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
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
  const [chatChannel, setChatChannel] = useState<string>(
    () => localStorage.getItem(`${CHANNEL_KEY_PREFIX}${sessionId}`) || '__lobby__',
  )
  const [originalName, setOriginalName] = useState(savedName || '')
  const [activeTab, setActiveTab] = useState<Tab>('teams')
  const kickMissCount = useRef(0)

  // Persist team state to localStorage
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
    }
  }, [allTeams, sessionId])

  useEffect(() => {
    localStorage.setItem(`${CHANNEL_KEY_PREFIX}${sessionId}`, chatChannel)
  }, [chatChannel, sessionId])

  // Load current skill from DB on mount if already joined
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
          .update({ name: newName, skill: skill })
          .eq('session_id', sessionId)
          .eq('name', originalName)

        if (error) throw error

        setOriginalName(newName)
        localStorage.setItem(`${JOINED_KEY_PREFIX}${sessionId}`, newName)
      } else {
        // Check if a record with this name already exists (reconnecting player)
        const { data: existing } = await supabase
          .from('live_players')
          .select('id, skill')
          .eq('session_id', sessionId)
          .eq('name', name.trim())
          .limit(1)

        if (existing && existing.length > 0) {
          // Reclaim: update skill and resume the session
          await supabase
            .from('live_players')
            .update({ skill })
            .eq('session_id', sessionId)
            .eq('name', name.trim())
        } else {
          const { error } = await supabase.from('live_players').insert({
            session_id: sessionId,
            name: name.trim(),
            skill: skill,
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
    setStatus('idle')
    setName('')
    setSkill(5)
    setOriginalName('')
    setTeamName(null)
    setAllTeams({})
    setChatChannel('__lobby__')
  }

  // Check if player was kicked
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
      setStatus('kicked')
      setOriginalName('')
      setTeamName(null)
      setAllTeams({})
      setChatChannel('__lobby__')
    }

    const checkKicked = async () => {
      // Method 1: explicit kick list — immediate
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
        // no kick record, continue
      }

      // Method 2: check live_players — require 3 consecutive misses
      // to avoid false kicks from transient network issues or cold starts
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
        // network error — don't count as a miss
      }
    }

    // Delay first check to let Supabase connection settle after refresh
    const initialDelay = setTimeout(() => {
      checkKicked()
    }, 3000)
    const poll = setInterval(checkKicked, 2000)
    return () => { clearTimeout(initialDelay); clearInterval(poll) }
  }, [status, sessionId, name])

  // Poll for published team results
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

      if (!data?.teams_json) return

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
        if (myTeam) {
          setTeamName(prev => {
            if (!prev) setChatChannel(myTeam)
            return myTeam
          })
        }
      } catch {
        // Invalid JSON
      }
    }

    check()
    const poll = setInterval(check, 2000)
    return () => clearInterval(poll)
  }, [status, sessionId, name])

  // ── TEAMS ASSIGNED — full-screen app layout ──
  if (status === 'success' && teamName) {
    const teamEntries = Object.entries(allTeams).sort(([a], [b]) => {
      if (a === teamName) return -1
      if (b === teamName) return 1
      return a.localeCompare(b)
    })

    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col max-w-lg mx-auto">
        {/* ── Top bar ── */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-white/50 text-[11px] font-medium uppercase tracking-wider">Your team</p>
            <p className="text-white font-bold text-[17px] leading-tight truncate">{teamName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="text-white/40 hover:text-white/70 transition-colors p-2"
              title="Edit name or skill"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={handleLeave}
              className="text-white/40 hover:text-rausch transition-colors p-2"
              title="Leave session"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="px-4 flex gap-1 mb-1">
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              activeTab === 'teams'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Teams
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              activeTab === 'chat'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Chat
          </button>
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'teams' ? (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {teamEntries.map(([team, members]) => {
                const isMyTeam = team === teamName
                return (
                  <div
                    key={team}
                    className={`rounded-xl p-3.5 transition-all ${
                      isMyTeam
                        ? 'bg-gradient-to-br from-rausch/20 to-[#D70466]/10 border border-rausch/20'
                        : 'bg-white/[0.05] border border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold ${
                          isMyTeam
                            ? 'bg-rausch text-white'
                            : 'bg-white/10 text-white/60'
                        }`}
                      >
                        {team.charAt(0)}
                      </div>
                      <p className={`text-[13px] font-bold ${isMyTeam ? 'text-white' : 'text-white/70'}`}>
                        {team}
                      </p>
                      {isMyTeam && (
                        <span className="text-[10px] font-medium text-rausch/80 bg-rausch/10 px-1.5 py-0.5 rounded-full ml-auto">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map(m => {
                        const isMe = m.toLowerCase() === name.trim().toLowerCase()
                        return (
                          <span
                            key={m}
                            className={`text-[12px] px-2.5 py-1 rounded-lg font-medium ${
                              isMe
                                ? 'bg-rausch text-white'
                                : isMyTeam
                                  ? 'bg-white/10 text-white/80'
                                  : 'bg-white/[0.06] text-white/50'
                            }`}
                          >
                            {m}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Voice bar at bottom of teams view */}
              <div className="pt-1">
                <VoiceBar
                  sessionId={sessionId}
                  channel={chatChannel}
                  playerName={name.trim()}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Channel switcher + voice — compact single row */}
              <div className="px-4 py-1.5 flex items-center gap-1.5">
                <button
                  onClick={() => setChatChannel('__lobby__')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    chatChannel === '__lobby__'
                      ? 'bg-white/15 text-white'
                      : 'text-white/35 hover:text-white/60 hover:bg-white/5'
                  }`}
                >
                  # Lobby
                </button>
                <button
                  onClick={() => setChatChannel(teamName)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    chatChannel === teamName
                      ? 'bg-white/15 text-white'
                      : 'text-white/35 hover:text-white/60 hover:bg-white/5'
                  }`}
                >
                  # {teamName}
                </button>
                <div className="ml-auto">
                  <VoiceBar
                    sessionId={sessionId}
                    channel={chatChannel}
                    playerName={name.trim()}
                  />
                </div>
              </div>

              {/* Chat fills remaining space */}
              <div className="flex-1 min-h-0">
                <TeamChat
                  sessionId={sessionId}
                  channel={chatChannel}
                  channelLabel={chatChannel === '__lobby__' ? 'Lobby' : chatChannel}
                  playerName={name.trim()}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── WAITING FOR TEAMS ──
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col max-w-lg mx-auto">
        {/* Top bar */}
        <div className="px-4 pt-6 pb-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-babu/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-babu" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-1">You're In!</h1>
          <p className="text-white/50 text-sm">
            <span className="text-white/80 font-semibold">{name}</span> &middot; Skill {skill}
          </p>
        </div>

        {/* Spinner + waiting */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-6 h-6 border-2 border-rausch border-t-transparent rounded-full animate-spin" />
          <p className="text-white/30 text-[13px]">Waiting for the host to assign teams...</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 pb-4">
          <button
            onClick={handleEdit}
            className="text-sm text-white/40 hover:text-white/70 font-medium transition-colors"
          >
            Edit
          </button>
          <span className="text-white/15">|</span>
          <button
            onClick={handleLeave}
            className="text-sm text-white/40 hover:text-rausch font-medium transition-colors"
          >
            Leave
          </button>
        </div>

        {/* Lobby voice + chat while waiting */}
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-2 space-y-2">
          <VoiceBar
            sessionId={sessionId}
            channel="__lobby__"
            playerName={name.trim()}
          />
          <div className="flex-1 min-h-0">
            <TeamChat
              sessionId={sessionId}
              channel="__lobby__"
              channelLabel="Lobby"
              playerName={name.trim()}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── KICKED ──
  if (status === 'kicked') {
    return (
      <div className="min-h-screen bg-kazan flex items-center justify-center p-4">
        <BackgroundWidgets />
        <div className="bg-white rounded-2xl shadow-airbnb-lg p-8 max-w-sm w-full text-center animate-fade-in">
          <div className="w-16 h-16 bg-rausch/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-rausch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-hackberry mb-2">Removed from Session</h1>
          <p className="text-hof mb-6">
            The host removed you from this session.
          </p>
          <button
            onClick={() => {
              setName('')
              setSkill(5)
              setStatus('idle')
            }}
            className="btn-generate w-full text-base py-3.5"
          >
            Rejoin
          </button>
        </div>
      </div>
    )
  }

  // ── JOIN / EDIT FORM ──
  const isEditing = status === 'editing'

  return (
    <div className="min-h-screen bg-kazan flex items-center justify-center p-4">
      <BackgroundWidgets />
      <div className="bg-white rounded-2xl shadow-airbnb-lg p-8 max-w-sm w-full animate-fade-in">
        <h1 className="text-2xl font-bold text-hackberry mb-1">
          {isEditing ? 'Update Info' : 'Join Session'}
        </h1>
        <p className="text-sm text-foggy mb-6">
          Code: <span className="font-mono font-bold text-lg text-hackberry tracking-wide">{sessionId}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-hackberry mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (status === 'error') setStatus('idle') }}
              required
              autoFocus
              placeholder="Enter your name"
              className="input-field text-lg py-3 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-hackberry mb-2">
              Skill Level
            </label>
            <div className="flex gap-1.5 justify-between">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSkill(n)}
                  className={`w-9 h-9 rounded-full text-sm font-bold transition-all duration-150 ${
                    skill === n
                      ? 'bg-rausch text-white scale-110'
                      : 'bg-kazan text-hof hover:bg-kazan-dark'
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
            className="btn-generate w-full text-base py-3.5"
          >
            {status === 'submitting' ? 'Saving...' : isEditing ? 'Save Changes' : 'Join'}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={() => { setStatus('success'); setName(originalName); setErrorMsg('') }}
              className="w-full text-sm text-foggy hover:text-hackberry font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
