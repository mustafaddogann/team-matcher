import { useState } from 'react'
import type { Participant, BalancerConfig } from '../types'
import ImportModal from './ImportModal'
import BulkAddModal from './BulkAddModal'

interface ParticipantTableProps {
  participants: Participant[]
  config: BalancerConfig
  onUpdate: (id: string, updates: Partial<Participant>) => void
  onRemove: (id: string) => void
  onAdd: () => void
  onSetParticipants: (participants: Participant[]) => void
}

export default function ParticipantTable({
  participants,
  config,
  onUpdate,
  onRemove,
  onAdd,
  onSetParticipants,
}: ParticipantTableProps) {
  const [showImport, setShowImport] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)

  const activeCount = participants.filter(p => p.name.trim() && !p.excluded).length
  const hasAnyLocked = participants.some(p => p.lockedTeam !== null)

  const unlockAll = () => {
    onSetParticipants(participants.map(p => ({ ...p, lockedTeam: null })))
  }

  return (
    <div className="card p-5 sm:p-6 card-3d">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-hackberry">
            Participants
          </h2>
          <span className="text-xs font-semibold text-foggy bg-kazan px-2.5 py-1 rounded-full">
            {activeCount} active
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            Import CSV/Excel
          </button>
          <button onClick={() => setShowBulkAdd(true)} className="btn-secondary">
            Bulk Add
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06]">
              <th className="text-left py-2.5 px-2 font-semibold text-foggy text-xs uppercase tracking-wide">Name</th>
              <th className="text-left py-2.5 px-2 font-semibold text-foggy text-xs uppercase tracking-wide w-24">Skill</th>
              <th className="text-left py-2.5 px-2 font-semibold text-foggy text-xs uppercase tracking-wide w-28">Role</th>
              <th className="text-center py-2.5 px-2 font-semibold text-foggy text-xs uppercase tracking-wide w-20">Exclude</th>
              <th className="text-left py-2.5 px-2 font-semibold text-foggy text-xs uppercase tracking-wide w-32">
                <span className="flex items-center gap-2">
                  Lock to Team
                  {hasAnyLocked && (
                    <button
                      onClick={unlockAll}
                      className="text-[10px] normal-case tracking-normal font-medium text-rausch hover:text-rausch-dark transition-colors"
                    >
                      (Unlock All)
                    </button>
                  )}
                </span>
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {participants.map(p => (
              <tr
                key={p.id}
                className={`border-b border-black/[0.04] hover:bg-kazan/60 transition-colors duration-150 ${p.excluded ? 'opacity-40' : ''}`}
              >
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => onUpdate(p.id, { name: e.target.value })}
                    placeholder="Player name"
                    className="input-field text-sm py-1.5"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={p.skill}
                    onChange={e => onUpdate(p.id, { skill: Number(e.target.value) || 0 })}
                    min={0}
                    className="input-field text-sm py-1.5 w-20 font-mono"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={p.role ?? ''}
                    onChange={e => onUpdate(p.id, { role: e.target.value || undefined })}
                    placeholder="Optional"
                    className="input-field text-sm py-1.5"
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={p.excluded}
                    onChange={e => onUpdate(p.id, { excluded: e.target.checked })}
                    className="h-4 w-4 rounded border-hackberry/20 text-rausch focus:ring-rausch/20 accent-rausch cursor-pointer"
                  />
                </td>
                <td className="py-2 px-2">
                  <select
                    value={p.lockedTeam ?? ''}
                    onChange={e =>
                      onUpdate(p.id, {
                        lockedTeam: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="input-field text-sm py-1.5"
                  >
                    <option value="">None</option>
                    {Array.from({ length: config.teamCount }, (_, i) => (
                      <option key={i} value={i}>
                        Team {i + 1}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => onRemove(p.id)}
                    className="text-foggy/40 hover:text-rausch transition-colors p-1.5 rounded-full hover:bg-rausch/5"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="sm:hidden space-y-3">
        {hasAnyLocked && (
          <button
            onClick={unlockAll}
            className="text-xs font-medium text-rausch hover:text-rausch-dark transition-colors mb-1"
          >
            Unlock All Teams
          </button>
        )}
        {participants.map(p => (
          <div
            key={p.id}
            className={`bg-kazan rounded-xl p-3.5 space-y-2.5 ${p.excluded ? 'opacity-40' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={p.name}
                onChange={e => onUpdate(p.id, { name: e.target.value })}
                placeholder="Player name"
                className="input-field text-sm py-1.5 flex-1"
              />
              <button
                onClick={() => onRemove(p.id)}
                className="text-foggy/50 hover:text-rausch transition-colors p-1 shrink-0"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs text-foggy mb-0.5 block font-medium">Skill</label>
                <input
                  type="number"
                  value={p.skill}
                  onChange={e => onUpdate(p.id, { skill: Number(e.target.value) || 0 })}
                  min={0}
                  className="input-field text-sm py-1.5 font-mono w-full"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-foggy mb-0.5 block font-medium">Role</label>
                <input
                  type="text"
                  value={p.role ?? ''}
                  onChange={e => onUpdate(p.id, { role: e.target.value || undefined })}
                  placeholder="Optional"
                  className="input-field text-sm py-1.5 w-full"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-foggy mb-0.5 block font-medium">Lock</label>
                <select
                  value={p.lockedTeam ?? ''}
                  onChange={e =>
                    onUpdate(p.id, {
                      lockedTeam: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="input-field text-sm py-1.5 w-full"
                >
                  <option value="">None</option>
                  {Array.from({ length: config.teamCount }, (_, i) => (
                    <option key={i} value={i}>
                      Team {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4">
                <input
                  type="checkbox"
                  checked={p.excluded}
                  onChange={e => onUpdate(p.id, { excluded: e.target.checked })}
                  className="h-4 w-4 rounded border-hackberry/20 text-rausch accent-rausch cursor-pointer"
                  title="Exclude"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onAdd} className="mt-4 text-sm text-rausch hover:text-rausch-dark font-semibold transition-colors">
        + Add Participant
      </button>

      {showImport && (
        <ImportModal
          onImport={onSetParticipants}
          onClose={() => setShowImport(false)}
        />
      )}

      {showBulkAdd && (
        <BulkAddModal
          onImport={onSetParticipants}
          existingParticipants={participants}
          onClose={() => setShowBulkAdd(false)}
        />
      )}
    </div>
  )
}
