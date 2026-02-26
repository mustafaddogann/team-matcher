import { useState } from 'react'
import type { Participant } from '../types'
import { generateId } from '../hooks/useTeamMatcher'

interface BulkAddModalProps {
  onImport: (participants: Participant[]) => void
  existingParticipants: Participant[]
  onClose: () => void
}

export default function BulkAddModal({ onImport, existingParticipants, onClose }: BulkAddModalProps) {
  const [text, setText] = useState('')

  const parsed = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      const parts = line.split(/[,\t]/).map(s => s.trim())
      return {
        name: parts[0] ?? '',
        skill: Number(parts[1]) || 0,
      }
    })

  const validCount = parsed.filter(p => p.name).length

  const handleImport = () => {
    const newParticipants: Participant[] = parsed
      .filter(p => p.name)
      .map(p => ({
        id: generateId(),
        name: p.name,
        skill: p.skill,
        excluded: false,
        lockedTeam: null,
      }))

    const existing = existingParticipants.filter(p => p.name.trim())
    onImport([...existing, ...newParticipants])
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-airbnb-xl max-w-lg w-full animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-4 border-b border-black/[0.06]">
          <h3 className="text-lg font-bold text-hackberry">Bulk Add Participants</h3>
          <button onClick={onClose} className="text-foggy hover:text-hackberry p-1 transition-colors rounded-full hover:bg-kazan">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-hof mb-3">
            Paste one participant per line. Format: <code className="bg-kazan px-1.5 py-0.5 rounded text-hackberry text-xs font-mono">name, skill</code>
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"Alice, 85\nBob, 72\nCharlie, 90"}
            rows={8}
            className="input-field text-sm font-mono"
          />
          {text.trim() && (
            <p className="text-sm text-foggy mt-2 font-medium">
              {validCount} valid participant{validCount !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 pt-4 border-t border-black/[0.06]">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={validCount === 0}
            className="btn-primary"
          >
            Add {validCount} Participant{validCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
