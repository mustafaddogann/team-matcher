import { useState, useEffect, useRef } from 'react'
import { getSupabase } from '../lib/supabase'
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

    const TEAM_COLORS = [
      { bg: 'from-[#FF385C]/15 to-[#D70466]/8', border: 'border-[#FF385C]/25', badge: 'bg-[#FF385C]', glow: 'shadow-[0_0_30px_rgba(255,56,92,0.15)]' },
      { bg: 'from-[#00A699]/15 to-[#00867A]/8', border: 'border-[#00A699]/25', badge: 'bg-[#00A699]', glow: 'shadow-[0_0_30px_rgba(0,166,153,0.15)]' },
      { bg: 'from-[#6C5CE7]/15 to-[#5A4BD1]/8', border: 'border-[#6C5CE7]/25', badge: 'bg-[#6C5CE7]', glow: 'shadow-[0_0_30px_rgba(108,92,231,0.15)]' },
      { bg: 'from-[#FC642D]/15 to-[#E8571F]/8', border: 'border-[#FC642D]/25', badge: 'bg-[#FC642D]', glow: 'shadow-[0_0_30px_rgba(252,100,45,0.15)]' },
      { bg: 'from-[#0984E3]/15 to-[#0770C2]/8', border: 'border-[#0984E3]/25', badge: 'bg-[#0984E3]', glow: 'shadow-[0_0_30px_rgba(9,132,227,0.15)]' },
      { bg: 'from-[#E17055]/15 to-[#D35D43]/8', border: 'border-[#E17055]/25', badge: 'bg-[#E17055]', glow: 'shadow-[0_0_30px_rgba(225,112,85,0.15)]' },
    ]

    const teamsPanel = (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 md:px-5">
        {teamEntries.map(([team, members], idx) => {
          const isMyTeam = team === teamName
          const colors = TEAM_COLORS[idx % TEAM_COLORS.length]
          return (
            <div
              key={team}
              className={`team-card-enter rounded-2xl p-4 transition-all border backdrop-blur-sm ${
                isMyTeam
                  ? `bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.glow}`
                  : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
              }`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Team header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-[14px] font-extrabold text-white ${
                    isMyTeam ? colors.badge : 'bg-white/10'
                  }`}
                >
                  {team.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-bold leading-tight truncate ${isMyTeam ? 'text-white' : 'text-white/60'}`}>
                    {team}
                  </p>
                  <p className={`text-[11px] ${isMyTeam ? 'text-white/50' : 'text-white/25'}`}>
                    {members.length} player{members.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {isMyTeam && (
                  <span className="text-[10px] font-bold text-white tracking-wider bg-white/15 px-2.5 py-1 rounded-full uppercase">
                    Your Team
                  </span>
                )}
              </div>

              {/* Members */}
              <div className="flex flex-wrap gap-2">
                {members.map(m => {
                  const isMe = m.toLowerCase() === name.trim().toLowerCase()
                  return (
                    <div
                      key={m}
                      className={`flex items-center gap-1.5 text-[12px] pl-1.5 pr-2.5 py-1 rounded-full font-medium transition-all ${
                        isMe
                          ? `${colors.badge} text-white`
                          : isMyTeam
                            ? 'bg-white/[0.08] text-white/80 border border-white/[0.06]'
                            : 'bg-white/[0.04] text-white/40 border border-white/[0.04]'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        isMe ? 'bg-white/25' : isMyTeam ? 'bg-white/10' : 'bg-white/[0.06]'
                      }`}>
                        {m.charAt(0).toUpperCase()}
                      </div>
                      {m}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="pt-2 md:hidden">
          <VoiceBar sessionId={sessionId} channel={chatChannel} playerName={name.trim()} />
        </div>
      </div>
    )

    const chatPanel = (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Channel switcher + voice */}
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
          {[
            { key: '__lobby__', label: 'Lobby' },
            { key: teamName, label: teamName },
          ].map(ch => {
            const active = chatChannel === ch.key
            return (
              <button
                key={ch.key}
                onClick={() => setChatChannel(ch.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  active
                    ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-white/30 hover:text-white/55 hover:bg-white/[0.04]'
                }`}
              >
                <span className={`text-[10px] ${active ? 'text-white/50' : 'text-white/20'}`}>#</span>
                {ch.label}
              </button>
            )
          })}
          <div className="ml-auto hidden md:block">
            <VoiceBar sessionId={sessionId} channel={chatChannel} playerName={name.trim()} />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <TeamChat
            sessionId={sessionId}
            channel={chatChannel}
            channelLabel={chatChannel === '__lobby__' ? 'Lobby' : chatChannel}
            playerName={name.trim()}
          />
        </div>
      </div>
    )

    return (
      <div className="tm-app-bg flex flex-col" style={{ height: '100dvh' }}>
        {/* Ambient glow effects */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] rounded-full bg-[#FF385C]/[0.03] blur-[100px]" />
          <div className="absolute -bottom-[30%] -right-[15%] w-[50%] h-[50%] rounded-full bg-[#00A699]/[0.03] blur-[100px]" />
        </div>

        {/* ── Top bar ── */}
        <div className="relative z-10 px-4 md:px-8 pt-5 pb-4 flex items-center justify-between max-w-screen-xl mx-auto w-full">
          <div className="flex items-center gap-4 min-w-0">
            {/* Team emblem */}
            <div className="relative">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-[#FF385C] to-[#D70466] flex items-center justify-center text-white font-extrabold text-xl md:text-2xl shadow-lg shadow-[#FF385C]/20">
                {teamName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-babu border-2 border-[#0f0f23] flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-[0.15em]">Your Team</p>
              <p className="text-white font-extrabold text-lg md:text-xl leading-tight truncate">{teamName}</p>
              <p className="text-white/30 text-[11px] mt-0.5">
                Playing as <span className="text-white/60 font-medium">{name}</span> &middot; Skill {skill}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleEdit}
              className="text-white/25 hover:text-white/60 hover:bg-white/5 transition-all p-2.5 rounded-xl"
              title="Edit name or skill"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={handleLeave}
              className="text-white/25 hover:text-rausch hover:bg-rausch/10 transition-all p-2.5 rounded-xl"
              title="Leave session"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Mobile: tab bar ── */}
        <div className="relative z-10 px-4 flex gap-1 mb-1 md:hidden">
          {[
            { key: 'teams' as Tab, label: 'Teams', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )},
            { key: 'chat' as Tab, label: 'Chat', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            )},
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold rounded-xl transition-all ${
                activeTab === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Desktop: side-by-side | Mobile: tabbed ── */}
        <div className="relative z-10 flex-1 flex flex-col md:flex-row min-h-0 max-w-screen-xl mx-auto w-full">
          {/* Teams panel */}
          <div className={`md:w-[340px] lg:w-[400px] md:flex md:flex-col md:border-r md:border-white/[0.04] md:flex-shrink-0 ${
            activeTab === 'teams' ? 'flex flex-col flex-1' : 'hidden md:flex'
          }`}>
            {teamsPanel}
          </div>

          {/* Chat panel */}
          <div className={`md:flex md:flex-col md:flex-1 md:min-w-0 ${
            activeTab === 'chat' ? 'flex flex-col flex-1' : 'hidden md:flex'
          }`}>
            {chatPanel}
          </div>
        </div>
      </div>
    )
  }

  // ── WAITING FOR TEAMS ──
  if (status === 'success') {
    return (
      <div className="tm-app-bg flex flex-col max-w-2xl mx-auto w-full" style={{ height: '100dvh' }}>
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[30%] left-[10%] w-[50%] h-[50%] rounded-full bg-[#00A699]/[0.04] blur-[100px]" />
          <div className="absolute -bottom-[20%] right-[5%] w-[40%] h-[40%] rounded-full bg-[#FF385C]/[0.03] blur-[80px]" />
        </div>

        {/* ── Status card ── */}
        <div className="relative z-10 px-5 pt-6 pb-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-5 animate-fade-in">
            <div className="flex items-center gap-4">
              {/* Player avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-babu to-[#00867A] flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-babu/20">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-babu border-2 border-[#0f0f23] flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-extrabold text-lg leading-tight truncate">{name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-semibold text-babu bg-babu/10 px-2 py-0.5 rounded-full">
                    Skill {skill}
                  </span>
                  <span className="text-[11px] text-white/25">&middot;</span>
                  <span className="text-[11px] text-white/30">{sessionId}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handleEdit}
                  className="text-white/25 hover:text-white/60 hover:bg-white/5 transition-all p-2.5 rounded-xl"
                  title="Edit name or skill"
                >
                  <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={handleLeave}
                  className="text-white/25 hover:text-rausch hover:bg-rausch/10 transition-all p-2.5 rounded-xl"
                  title="Leave session"
                >
                  <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Waiting indicator */}
            <div className="mt-4 pt-3.5 border-t border-white/[0.04] flex items-center gap-3">
              <div className="relative w-5 h-5 flex-shrink-0">
                <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
                <div className="absolute inset-0 rounded-full border-2 border-rausch border-t-transparent animate-spin" />
              </div>
              <p className="text-white/35 text-[13px]">Waiting for the host to assign teams...</p>
            </div>
          </div>
        </div>

        {/* ── Lobby chat ── */}
        <div className="relative z-10 flex-1 flex flex-col min-h-0 px-5 pb-2 pt-3 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-lg">
              <span className="text-white/25 text-[10px] font-bold">#</span>
              <span className="text-white/60 text-[12px] font-semibold">Lobby</span>
            </div>
            <div className="h-px flex-1 bg-white/[0.04]" />
            <span className="text-white/20 text-[11px]">Chat while you wait</span>
          </div>

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

  // ── JOIN / EDIT FORM ──
  const isEditing = status === 'editing'

  return (
    <div className="tm-app-bg min-h-screen flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[30%] left-[10%] w-[50%] h-[50%] rounded-full bg-[#FF385C]/[0.04] blur-[100px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#00A699]/[0.03] blur-[80px]" />
      </div>

      <div className="relative z-10 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-7 max-w-sm w-full animate-fade-in">
        {/* Session badge */}
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
              onChange={e => { setName(e.target.value); if (status === 'error') setStatus('idle') }}
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
              onClick={() => { setStatus('success'); setName(originalName); setErrorMsg('') }}
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
