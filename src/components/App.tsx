import { useState, useCallback, useEffect, useRef } from 'react'
import { useTeamMatcher } from '../hooks/useTeamMatcher'
import { useLiveSession } from '../hooks/useLiveSession'
import Header from './Header'
import ParticipantTable from './ParticipantTable'
import TeamSettings from './TeamSettings'
import TeamResults from './TeamResults'
import SummaryPanel from './SummaryPanel'
import ExportActions from './ExportActions'
import ShareSessionModal from './ShareSessionModal'
import BackgroundWidgets from './BackgroundWidgets'

const DB_MAP_KEY = 'tm-db-to-local:'
const SNAPSHOT_KEY = 'tm-remote-snapshot:'

function loadMap(sessionName: string | null): Map<string, string> {
  if (!sessionName) return new Map()
  try {
    const raw = localStorage.getItem(`${DB_MAP_KEY}${sessionName}`)
    return raw ? new Map(JSON.parse(raw)) : new Map()
  } catch { return new Map() }
}

function saveMap(sessionName: string | null, map: Map<string, string>) {
  if (!sessionName) return
  localStorage.setItem(`${DB_MAP_KEY}${sessionName}`, JSON.stringify([...map]))
}

function loadSnapshot(sessionName: string | null): Map<string, { name: string; skill: number }> {
  if (!sessionName) return new Map()
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_KEY}${sessionName}`)
    return raw ? new Map(JSON.parse(raw)) : new Map()
  } catch { return new Map() }
}

function saveSnapshot(sessionName: string | null, snap: Map<string, { name: string; skill: number }>) {
  if (!sessionName) return
  localStorage.setItem(`${SNAPSHOT_KEY}${sessionName}`, JSON.stringify([...snap]))
}

export default function App() {
  const tm = useTeamMatcher()
  const live = useLiveSession(tm.activeSessionName)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showSetupHint, setShowSetupHint] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'done'>('idle')
  const [playerChanges, setPlayerChanges] = useState<{ name: string; detail: string; oldName: string; newName: string; newSkill: number }[]>([])

  // Persist dbId → localId mapping and remote snapshot across refreshes
  const dbToLocalIdRef = useRef(loadMap(tm.activeSessionName))
  const snapshotRef = useRef(loadSnapshot(tm.activeSessionName))

  // Reload refs when session changes
  useEffect(() => {
    dbToLocalIdRef.current = loadMap(tm.activeSessionName)
    snapshotRef.current = loadSnapshot(tm.activeSessionName)
  }, [tm.activeSessionName])

  const handleStartLive = useCallback(() => {
    if (!live.supabaseAvailable) {
      setShowSetupHint(true)
      return
    }
    if (!tm.activeSessionName) {
      alert('Save your session with a name first (Sessions → type a name → Save)')
      return
    }
    live.startSession()
    dbToLocalIdRef.current = new Map()
    snapshotRef.current = new Map()
    saveMap(tm.activeSessionName, dbToLocalIdRef.current)
    saveSnapshot(tm.activeSessionName, snapshotRef.current)
    setShowShareModal(true)
  }, [live, tm.activeSessionName])

  const takeSnapshot = useCallback(() => {
    const snap = new Map(
      live.allRemotePlayers.map(rp => [rp.dbId, { name: rp.name, skill: rp.skill }]),
    )
    snapshotRef.current = snap
    saveSnapshot(tm.activeSessionName, snap)
  }, [live.allRemotePlayers, tm.activeSessionName])

  const handlePullPlayers = useCallback(() => {
    const pulled = live.pullRemotePlayers()
    if (pulled.length === 0) return

    const existing = tm.participants.filter(p => p.name.trim())
    const existingNames = new Set(existing.map(p => p.name.trim().toLowerCase()))
    const newPlayers = pulled.filter(p => !existingNames.has(p.name.trim().toLowerCase()))

    if (newPlayers.length > 0) {
      tm.setParticipants([...existing, ...newPlayers])
    }

    // Record dbId → local participant id mapping
    for (const rp of live.allRemotePlayers) {
      const localPlayer = [...existing, ...newPlayers].find(
        p => p.name.trim().toLowerCase() === rp.name.trim().toLowerCase(),
      )
      if (localPlayer) {
        dbToLocalIdRef.current.set(rp.dbId, localPlayer.id)
      }
    }
    saveMap(tm.activeSessionName, dbToLocalIdRef.current)

    takeSnapshot()
    setShowShareModal(false)
  }, [live, tm, takeSnapshot])

  // Detect remote player changes
  useEffect(() => {
    if (!live.isActive || snapshotRef.current.size === 0) return

    const newChanges: { name: string; detail: string; oldName: string; newName: string; newSkill: number }[] = []

    for (const rp of live.allRemotePlayers) {
      const known = snapshotRef.current.get(rp.dbId)
      if (!known) continue
      if (rp.name !== known.name || rp.skill !== known.skill) {
        const parts: string[] = []
        if (rp.name !== known.name) parts.push(`name: ${known.name} \u2192 ${rp.name}`)
        if (rp.skill !== known.skill) parts.push(`skill: ${known.skill} \u2192 ${rp.skill}`)
        newChanges.push({
          name: rp.name,
          detail: parts.join(', '),
          oldName: known.name,
          newName: rp.name,
          newSkill: rp.skill,
        })
      }
    }

    if (newChanges.length > 0) {
      // Build oldName → change lookup
      const byOldName = new Map(newChanges.map(c => [c.oldName.trim().toLowerCase(), c]))

      // Update participants — match by old name (participant still has the old name)
      const updatedParticipants = tm.participants.map(p => {
        const change = byOldName.get(p.name.trim().toLowerCase())
        if (change) return { ...p, name: change.newName, skill: change.newSkill }
        return p
      })

      tm.setParticipants(updatedParticipants)
      setPlayerChanges(prev => [...prev, ...newChanges])

      // Update snapshot so we don't re-detect
      takeSnapshot()
    }
  }, [live.allRemotePlayers, live.isActive, tm.participants, tm.setParticipants, takeSnapshot])

  const handleRemoveParticipant = useCallback((id: string) => {
    // If live, also delete from Supabase so the player can rejoin
    if (live.isActive) {
      const player = tm.participants.find(p => p.id === id)
      if (player?.name.trim()) {
        live.kickPlayer(player.name.trim())
      }
      // Republish teams without the kicked player so their screen updates
      if (tm.teams.length > 0) {
        const updatedTeams = tm.teams.map(t => ({
          ...t,
          members: t.members.filter(m => m.id !== id),
        }))
        live.publishTeams(updatedTeams)
      }
    }
    tm.removeParticipant(id)
  }, [live, tm.participants, tm.teams, tm.removeParticipant])

  const handleEndSession = useCallback(() => {
    live.stopSession()
    setShowShareModal(false)
  }, [live])

  const handlePublishTeams = useCallback(async () => {
    if (tm.teams.length === 0) return
    setPublishStatus('publishing')
    const ok = await live.publishTeams(tm.teams)
    setPublishStatus(ok ? 'done' : 'idle')
  }, [live, tm.teams])

  return (
    <div className="min-h-screen bg-white">
      <BackgroundWidgets />
      <Header
        onSave={tm.saveSession}
        onLoad={tm.loadSession}
        getSessions={tm.getSavedSessions}
        onClearAll={tm.clearAll}
        onNewSession={tm.newSession}
        onDeleteSession={tm.deleteSession}
        activeSessionName={tm.activeSessionName}
        isLive={live.isActive}
        onStartLive={handleStartLive}
        onShowShare={() => setShowShareModal(true)}
        remotePlayerCount={live.remotePlayers.length}
      />

      <main className="mx-auto px-4 py-8 sm:px-6 lg:px-10 xl:px-16 space-y-8">
        <ParticipantTable
          participants={tm.participants}
          config={tm.config}
          onUpdate={tm.updateParticipant}
          onRemove={handleRemoveParticipant}
          onAdd={tm.addParticipant}
          onSetParticipants={tm.setParticipants}
        />

        <TeamSettings
          config={tm.config}
          onUpdate={tm.updateConfig}
          onGenerate={() => { tm.generateTeams(); setPublishStatus('idle'); setPlayerChanges([]); takeSnapshot() }}
          onShuffleNames={tm.shuffleTeamNames}
          canGenerate={tm.hasValidParticipants}
          hasTeams={tm.teams.length > 0}
        />

        {playerChanges.length > 0 && tm.teams.length > 0 && (
          <div className="bg-arches/5 border border-arches/20 rounded-2xl p-5 animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">&#9888;&#65039;</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-hackberry mb-1">Players updated since last generation</p>
                <ul className="text-sm text-hof space-y-0.5 mb-3">
                  {playerChanges.map((c, i) => (
                    <li key={i}><span className="font-semibold">{c.name}</span> — {c.detail}</li>
                  ))}
                </ul>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { tm.generateTeams(); setPublishStatus('idle'); setPlayerChanges([]); takeSnapshot() }}
                    className="btn-primary"
                  >
                    Re-generate Teams
                  </button>
                  <button
                    onClick={() => {
                      const changeMap = new Map(
                        playerChanges.map(c => [c.oldName.trim().toLowerCase(), { name: c.newName, skill: c.newSkill }]),
                      )
                      const patched = tm.teams.map(t => ({
                        ...t,
                        members: t.members.map(m => {
                          const update = changeMap.get(m.name.trim().toLowerCase())
                          return update ? { ...m, name: update.name, skill: update.skill } : m
                        }),
                      }))
                      tm.setTeams(patched)
                      setPublishStatus('idle')
                      setPlayerChanges([])
                    }}
                    className="px-4 py-2 bg-babu/10 text-babu text-sm font-semibold rounded-lg hover:bg-babu/20 transition-colors"
                  >
                    Just Update Names
                  </button>
                  <button
                    onClick={() => setPlayerChanges([])}
                    className="px-4 py-2 text-foggy text-sm font-semibold hover:bg-kazan rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tm.teams.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              {live.isActive ? (
                <button
                  onClick={handlePublishTeams}
                  disabled={publishStatus === 'publishing'}
                  className={`text-sm px-5 py-2.5 rounded-lg font-semibold transition-all ${
                    publishStatus === 'done'
                      ? 'bg-babu/8 text-babu border border-babu/20'
                      : 'btn-primary'
                  }`}
                >
                  {publishStatus === 'publishing' ? 'Publishing...' : publishStatus === 'done' ? 'Published to Players' : 'Publish Teams to Players'}
                </button>
              ) : <div />}
              <ExportActions teams={tm.teams} />
            </div>

            <SummaryPanel teams={tm.teams} />

            <TeamResults
              teams={tm.teams}
              autoTeams={tm.autoTeams}
              onMove={tm.moveParticipant}
              onRename={tm.renameTeam}
              onReset={tm.resetToAuto}
            />
          </>
        )}
      </main>

      {showShareModal && live.sessionId && (
        <ShareSessionModal
          sessionId={live.sessionId}
          remotePlayers={live.remotePlayers}
          onPull={handlePullPlayers}
          onEnd={handleEndSession}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showSetupHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSetupHint(false)}>
          <div className="bg-white rounded-2xl shadow-airbnb-xl p-6 max-w-md w-full mx-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-hackberry">Supabase Setup Required</h2>
              <button onClick={() => setShowSetupHint(false)} className="text-foggy hover:text-hackberry text-2xl leading-none transition-colors">&times;</button>
            </div>
            <p className="text-sm text-hof mb-3">
              Live sessions need a Supabase project with Realtime enabled. Create a free project at{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-rausch hover:underline font-medium">supabase.com/dashboard</a>,
              then add your credentials to a <code className="bg-kazan px-1.5 py-0.5 rounded text-hackberry text-xs font-mono">.env</code> file:
            </p>
            <pre className="text-xs text-hof bg-kazan p-4 rounded-xl overflow-x-auto font-mono border border-black/[0.06]">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
            </pre>
            <p className="text-xs text-foggy mt-3">See <code className="text-hof font-mono">.env.example</code> for the full template. Restart the dev server after adding the file.</p>
          </div>
        </div>
      )}
    </div>
  )
}
