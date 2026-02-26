import { useState } from 'react'
import type { Team } from '../types'
import { downloadCSV, copyToClipboard } from '../services/exportService'

interface ExportActionsProps {
  teams: Team[]
}

export default function ExportActions({ teams }: ExportActionsProps) {
  const [copied, setCopied] = useState(false)

  if (teams.length === 0) return null

  const handleCopy = async () => {
    await copyToClipboard(teams)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => downloadCSV(teams)} className="btn-secondary">
        Export CSV
      </button>
      <button onClick={handleCopy} className="btn-secondary">
        {copied ? 'Copied!' : 'Copy to Clipboard'}
      </button>
    </div>
  )
}
