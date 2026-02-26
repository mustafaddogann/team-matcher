import { useState, useRef, useEffect } from 'react'
import type { Team } from '../types'

interface TeamCardProps {
  team: Team
  allTeams: Team[]
  avgTotal: number
  onMove: (participantId: string, fromTeam: number, toTeam: number) => void
  onRename: (teamIndex: number, newName: string) => void
}

export default function TeamCard({ team, allTeams, avgTotal, onMove, onRename }: TeamCardProps) {
  const total = team.members.reduce((sum, m) => sum + m.skill, 0)
  const avg = team.members.length > 0 ? total / team.members.length : 0
  const diff = total - avgTotal

  // Determine visual indicator
  const allTotals = allTeams.map(t => t.members.reduce((s, m) => s + m.skill, 0))
  const maxTotal = Math.max(...allTotals)
  const minTotal = Math.min(...allTotals)
  const isBest = total === minTotal && maxTotal !== minTotal
  const isWorst = total === maxTotal && maxTotal !== minTotal

  return (
    <div
      className={`card p-5 transition-all duration-200 hover:shadow-airbnb-hover ${
        isBest
          ? 'ring-2 ring-babu/30'
          : isWorst
            ? 'ring-2 ring-arches/30'
            : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <EditableTeamName
          name={team.name}
          onSave={newName => onRename(team.index, newName)}
        />
        <span className="text-xs text-foggy font-medium">{team.members.length} members</span>
      </div>

      <div className="flex gap-2 text-sm mb-4">
        <div className="bg-kazan rounded-lg px-2.5 py-1">
          <span className="text-foggy">Total:</span>{' '}
          <span className="font-semibold text-hackberry font-mono">{total}</span>
        </div>
        <div className="bg-kazan rounded-lg px-2.5 py-1">
          <span className="text-foggy">Avg:</span>{' '}
          <span className="font-semibold text-hackberry font-mono">{avg.toFixed(1)}</span>
        </div>
        <div
          className={`rounded-lg px-2.5 py-1 font-mono font-semibold ${
            diff > 0
              ? 'bg-arches/8 text-arches'
              : diff < 0
                ? 'bg-babu/8 text-babu'
                : 'bg-kazan text-foggy'
          }`}
        >
          {diff > 0 ? '+' : ''}{diff.toFixed(1)}
        </div>
      </div>

      <ul className="space-y-0.5">
        {team.members.map(member => (
          <li key={member.id} className="flex items-center justify-between text-sm group py-1.5 px-2.5 -mx-2.5 rounded-lg hover:bg-kazan transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate font-medium text-hackberry">{member.name}</span>
              <span className="text-foggy font-mono text-xs shrink-0">{member.skill}</span>
              {member.role && (
                <span className="text-xs text-foggy bg-kazan px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                  {member.role}
                </span>
              )}
              {member.lockedTeam !== null && (
                <span className="text-xs text-rausch font-medium" title="Locked to this team">
                  locked
                </span>
              )}
            </div>

            <select
              value=""
              onChange={e => {
                if (e.target.value) {
                  onMove(member.id, team.index, Number(e.target.value))
                  e.target.value = ''
                }
              }}
              className="text-xs border border-hackberry/15 rounded-lg px-1.5 py-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-white text-hof cursor-pointer"
            >
              <option value="">Move to...</option>
              {allTeams
                .filter(t => t.index !== team.index)
                .map(t => (
                  <option key={t.index} value={t.index}>
                    {t.name}
                  </option>
                ))}
            </select>
          </li>
        ))}
      </ul>

      {team.members.length === 0 && (
        <p className="text-sm text-foggy italic">No members</p>
      )}
    </div>
  )
}

function EditableTeamName({ name, onSave }: { name: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(name)
  }, [name])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) onSave(trimmed)
    else setDraft(name)
    setEditing(false)
  }

  if (!editing) {
    return (
      <h3
        className="font-bold text-hackberry cursor-pointer hover:text-rausch transition-colors"
        onClick={() => setEditing(true)}
        title="Click to rename"
      >
        {name}
      </h3>
    )
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') { setDraft(name); setEditing(false) }
      }}
      className="font-bold text-hackberry bg-transparent border-b-2 border-rausch outline-none w-40"
    />
  )
}
