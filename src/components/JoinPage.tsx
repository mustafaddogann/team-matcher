import { useState, useEffect } from 'react'
import { getSupabase } from '../lib/supabase'
import BackgroundWidgets from './BackgroundWidgets'
import TeamChat from './TeamChat'
import VoiceBar from './VoiceBar'

interface JoinPageProps {
  sessionId: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error' | 'editing' | 'kicked'

const JOINED_KEY_PREFIX = 'tm-joined-'

// v2 – edit link on team results
export default function JoinPage({ sessionId }: JoinPageProps) {
  const savedName = localStorage.getItem(`${JOINED_KEY_PREFIX}${sessionId}`)
  const [name, setName] = useState(savedName || '')
  const [skill, setSkill] = useState(5)
  const [status, setStatus] = useState<Status>(savedName ? 'success' : 'idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [teamName, setTeamName] = useState<string | null>(null)
  const [allTeams, setAllTeams] = useState<Record<string, string[]>>({})
  const [chatChannel, setChatChannel] = useState<string>('__lobby__')
  // The original name stored in DB (for updates)
  const [originalName, setOriginalName] = useState(savedName || '')

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

      // Helper: check if a name is genuinely taken (not a leftover from a kicked player)
      const isNameTaken = async (checkName: string): Promise<boolean> => {
        const { data: existing } = await supabase
          .from('live_players')
          .select('id')
          .eq('session_id', sessionId)
          .eq('name', checkName)
          .limit(1)

        if (!existing || existing.length === 0) return false

        // Row exists — check if this player was kicked (stale row)
        const kickKey = `${sessionId}:kicks`
        const { data: kickData } = await supabase
          .from('session_teams')
          .select('teams_json')
          .eq('session_id', kickKey)
          .single()

        if (kickData?.teams_json) {
          const kicked: string[] = JSON.parse(kickData.teams_json)
          if (kicked.some(k => k.toLowerCase() === checkName.toLowerCase())) {
            // Stale row from a kicked player — clean it up and allow the name
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
        // Updating existing player
        const newName = name.trim()
        const nameChanged = newName.toLowerCase() !== originalName.toLowerCase()

        // If name changed, check the new name isn't taken
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
        // New player joining
        if (await isNameTaken(name.trim())) {
          setErrorMsg('That name is already taken. Try a different one.')
          setStatus('error')
          return
        }

        const { error } = await supabase.from('live_players').insert({
          session_id: sessionId,
          name: name.trim(),
          skill: skill,
        })
        if (error) throw error

        setOriginalName(name.trim())
        localStorage.setItem(`${JOINED_KEY_PREFIX}${sessionId}`, name.trim())
      }

      // Clear any existing kick record so player isn't immediately re-kicked
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
        // Best effort — don't block join if this fails
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
    setStatus('idle')
    setName('')
    setSkill(5)
    setOriginalName('')
    setTeamName(null)
    setAllTeams({})
    setChatChannel('__lobby__')
  }

  // Check if player was kicked — two methods for reliability
  useEffect(() => {
    if (status !== 'success') return

    const supabase = getSupabase()
    if (!supabase) return

    const handleKick = () => {
      localStorage.removeItem(`${JOINED_KEY_PREFIX}${sessionId}`)
      setStatus('kicked')
      setOriginalName('')
      setTeamName(null)
      setAllTeams({})
      setChatChannel('__lobby__')
    }

    const checkKicked = async () => {
      // Method 1: Check the kicks record in session_teams
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
        // Query failed, try method 2
      }

      // Method 2: Check if player record still exists in live_players
      try {
        const { data } = await supabase
          .from('live_players')
          .select('id')
          .eq('session_id', sessionId)
          .eq('name', name.trim())
          .limit(1)

        if (!data || data.length === 0) {
          handleKick()
        }
      } catch {
        // Query failed, will retry on next poll
      }
    }

    checkKicked()
    const poll = setInterval(checkKicked, 2000)

    return () => clearInterval(poll)
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
        // Invalid JSON, skip
      }
    }

    check()
    const poll = setInterval(check, 2000)
    return () => clearInterval(poll)
  }, [status, sessionId, name])

  // Success / waiting / teams view
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-kazan flex items-start justify-center p-4 pt-10">
        <BackgroundWidgets />
        <div className="bg-white rounded-2xl shadow-airbnb-lg p-8 max-w-md w-full text-center animate-fade-in">
          {teamName ? (
            <>
              <div className="text-4xl mb-3">&#127942;</div>
              <h1 className="text-xl font-bold text-hackberry mb-1">You're on</h1>
              <p className="text-3xl font-bold text-rausch mb-5">{teamName}</p>

              <div className="text-left space-y-3 mt-4 border-t border-black/[0.06] pt-5">
                {Object.entries(allTeams)
                  .sort(([a], [b]) => {
                    if (a === teamName) return -1
                    if (b === teamName) return 1
                    return a.localeCompare(b)
                  })
                  .map(([team, members]) => (
                    <div
                      key={team}
                      className={`rounded-xl p-3.5 ${
                        team === teamName
                          ? 'bg-rausch/5 border border-rausch/15'
                          : 'bg-kazan'
                      }`}
                    >
                      <p className={`text-sm font-bold mb-2 ${
                        team === teamName ? 'text-rausch' : 'text-hackberry'
                      }`}>
                        {team}
                        {team === teamName && <span className="text-xs font-normal ml-1 text-rausch/60">(your team)</span>}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {members.map(m => (
                          <span
                            key={m}
                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                              m.toLowerCase() === name.trim().toLowerCase()
                                ? 'bg-rausch text-white'
                                : 'bg-white text-hof border border-black/[0.08]'
                            }`}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={handleEdit}
                  className="flex-1 py-2.5 rounded-lg border border-hackberry/20 text-hackberry text-sm font-semibold hover:bg-kazan transition-colors"
                >
                  Edit name or skill
                </button>
                <button
                  onClick={handleLeave}
                  className="py-2.5 px-4 rounded-lg border border-black/[0.08] text-foggy text-sm font-semibold hover:bg-kazan transition-colors"
                >
                  Leave
                </button>
              </div>

              {/* Channel tabs */}
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setChatChannel('__lobby__')}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    chatChannel === '__lobby__'
                      ? 'bg-rausch text-white'
                      : 'bg-kazan text-hof hover:bg-kazan-dark'
                  }`}
                >
                  Lobby
                </button>
                <button
                  onClick={() => setChatChannel(teamName)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    chatChannel === teamName
                      ? 'bg-rausch text-white'
                      : 'bg-kazan text-hof hover:bg-kazan-dark'
                  }`}
                >
                  {teamName}
                </button>
              </div>

              <div className="mt-3">
                <VoiceBar
                  sessionId={sessionId}
                  channel={chatChannel}
                  playerName={name.trim()}
                />
              </div>

              <div className="mt-3">
                <TeamChat
                  sessionId={sessionId}
                  channel={chatChannel}
                  channelLabel={chatChannel === '__lobby__' ? 'Lobby' : chatChannel}
                  playerName={name.trim()}
                />
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-babu/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-babu" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-hackberry mb-2">You're In!</h1>
              <p className="text-hof mb-1">
                <span className="font-bold text-hackberry">{name}</span> &middot; Skill: {skill}
              </p>
              <p className="text-foggy text-sm mb-5">
                Waiting for teams to be assigned...
              </p>
              <div className="flex justify-center mb-5">
                <div className="w-6 h-6 border-2 border-rausch border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleEdit}
                  className="text-sm text-rausch hover:text-rausch-dark font-semibold underline transition-colors"
                >
                  Edit name or skill
                </button>
                <span className="text-foggy">|</span>
                <button
                  onClick={handleLeave}
                  className="text-sm text-foggy hover:text-hackberry font-semibold underline transition-colors"
                >
                  Leave
                </button>
              </div>

              {/* Voice + lobby chat while waiting for teams */}
              <div className="mt-5 text-left space-y-3">
                <VoiceBar
                  sessionId={sessionId}
                  channel="__lobby__"
                  playerName={name.trim()}
                />
                <TeamChat
                  sessionId={sessionId}
                  channel="__lobby__"
                  channelLabel="Lobby"
                  playerName={name.trim()}
                />
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // Kicked screen — player was removed by host
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

  // Join / edit form
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
