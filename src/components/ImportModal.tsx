import { useState, useRef } from 'react'
import type { Participant, ImportPreview, ColumnMapping } from '../types'
import { parseFile } from '../services/importService'
import { applyMapping } from '../utils/columnMapping'
import { generateId } from '../hooks/useTeamMatcher'

interface ImportModalProps {
  onImport: (participants: Participant[]) => void
  onClose: () => void
}

type Step = 'upload' | 'mapping' | 'preview'

const STEPS: Step[] = ['upload', 'mapping', 'preview']
const STEP_LABELS = ['Upload', 'Map Columns', 'Preview']

export default function ImportModal({ onImport, onClose }: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({ name: null, skill: null, role: null })
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    try {
      setError(null)
      const result = await parseFile(file)
      setPreview(result)
      setMapping(result.mapping)
      setStep('mapping')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file')
    }
  }

  const handleConfirmMapping = () => {
    if (!mapping.name) {
      setError('Please select a Name column')
      return
    }
    setError(null)
    setStep('preview')
  }

  const handleImport = () => {
    if (!preview) return

    const mapped = applyMapping(preview.rows, mapping)
    const participants: Participant[] = mapped
      .filter(r => r.name.trim())
      .map(r => ({
        id: generateId(),
        name: r.name,
        skill: Number(r.skill) || 0,
        excluded: false,
        lockedTeam: null,
        lockSource: null,
        role: r.role || undefined,
      }))

    onImport(participants)
    onClose()
  }

  const previewRows = preview ? applyMapping(preview.rows.slice(0, 10), mapping) : []
  const currentStepIndex = STEPS.indexOf(step)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-airbnb-xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-4 border-b border-black/[0.06]">
          <div>
            <h3 className="text-lg font-bold text-hackberry">Import Participants</h3>
            {/* Step indicators */}
            <div className="flex items-center gap-1.5 mt-2.5">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i <= currentStepIndex
                      ? 'bg-rausch text-white'
                      : 'bg-kazan text-foggy'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i <= currentStepIndex ? 'text-hackberry' : 'text-foggy/50'}`}>
                    {STEP_LABELS[i]}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className={`w-8 h-px mx-1 ${i < currentStepIndex ? 'bg-rausch' : 'bg-kazan-dark'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-foggy hover:text-hackberry p-1 transition-colors rounded-full hover:bg-kazan">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3.5 bg-rausch/5 border border-rausch/15 rounded-xl text-sm text-rausch font-medium">
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="text-center py-10">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="btn-generate text-base px-10 py-3.5"
              >
                Choose File
              </button>
              <p className="text-sm text-foggy mt-4">Supports CSV and Excel (.xlsx) files</p>
              <p className="text-sm text-foggy/60 mt-1">
                <a href="/sample-template.csv" download className="text-rausch hover:underline font-medium">
                  Download template CSV
                </a>
              </p>
            </div>
          )}

          {step === 'mapping' && preview && (
            <div>
              <p className="text-sm text-hof mb-4">
                Found {preview.rows.length} rows with {preview.headers.length} columns.
                Map columns to fields:
              </p>

              <div className="space-y-3">
                {(['name', 'skill', 'role'] as const).map(field => (
                  <div key={field} className="flex items-center gap-3">
                    <label className="w-16 text-sm font-semibold text-hackberry capitalize">
                      {field}{field === 'name' && <span className="text-rausch">*</span>}
                    </label>
                    <select
                      value={mapping[field] ?? ''}
                      onChange={e =>
                        setMapping(prev => ({
                          ...prev,
                          [field]: e.target.value || null,
                        }))
                      }
                      className="input-field text-sm flex-1"
                    >
                      <option value="">{field === 'role' ? '(skip)' : '— Select —'}</option>
                      {preview.headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {mapping[field] && (
                      <span className="text-xs text-babu font-semibold">Mapped</span>
                    )}
                  </div>
                ))}
              </div>

              {preview.errors.length > 0 && (
                <div className="mt-4 p-3 bg-arches/5 border border-arches/15 rounded-xl text-sm text-arches font-medium">
                  {preview.errors.length} potential issue{preview.errors.length > 1 ? 's' : ''} detected.
                  Rows with errors will be imported with defaults.
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="text-sm text-hof mb-4">
                Preview (first {Math.min(10, previewRows.length)} of {preview?.rows.length} rows):
              </p>
              <div className="overflow-x-auto rounded-xl border border-black/[0.06]">
                <table className="w-full text-sm">
                  <thead className="bg-kazan">
                    <tr>
                      <th className="text-left p-3 font-semibold text-foggy text-xs uppercase tracking-wide">Name</th>
                      <th className="text-left p-3 font-semibold text-foggy text-xs uppercase tracking-wide">Skill</th>
                      {mapping.role && <th className="text-left p-3 font-semibold text-foggy text-xs uppercase tracking-wide">Role</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className={`border-t border-black/[0.04] ${!row.name.trim() ? 'bg-rausch/5' : ''}`}>
                        <td className="p-3 text-hackberry">{row.name || <span className="text-rausch italic">empty</span>}</td>
                        <td className="p-3 text-hof font-mono">{row.skill}</td>
                        {mapping.role && <td className="p-3 text-hof">{row.role}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between p-5 pt-4 border-t border-black/[0.06]">
          <button
            onClick={() => {
              if (step === 'mapping') setStep('upload')
              else if (step === 'preview') setStep('mapping')
              else onClose()
            }}
            className="btn-secondary"
          >
            {step === 'upload' ? 'Cancel' : 'Back'}
          </button>

          {step === 'mapping' && (
            <button onClick={handleConfirmMapping} className="btn-primary">
              Next: Preview
            </button>
          )}

          {step === 'preview' && (
            <button onClick={handleImport} className="btn-primary">
              Import {preview?.rows.filter(r => mapping.name && r[mapping.name]?.trim()).length ?? 0} Participants
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
