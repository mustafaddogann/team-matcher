import { useState } from 'react'
import QRCode from 'react-qr-code'
import type { LivePlayer } from '../hooks/useLiveSession'

interface ShareSessionModalProps {
  sessionId: string
  remotePlayers: LivePlayer[]
  onPull: () => void
  onEnd: () => void
  onClose: () => void
}

export default function ShareSessionModal({
  sessionId,
  remotePlayers,
  onPull,
  onEnd,
  onClose,
}: ShareSessionModalProps) {
  const [copied, setCopied] = useState(false)

  const joinUrl = `${window.location.origin}${window.location.pathname}#/join/${encodeURIComponent(sessionId)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the input
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-airbnb-xl p-6 max-w-md w-full mx-4 space-y-5 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-hackberry">Live Session</h2>
          <button onClick={onClose} className="text-foggy hover:text-hackberry text-2xl leading-none transition-colors rounded-full w-8 h-8 flex items-center justify-center hover:bg-kazan">
            &times;
          </button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center bg-kazan p-5 rounded-2xl">
          <QRCode value={joinUrl} size={200} />
        </div>

        {/* Session Code */}
        <div className="text-center">
          <p className="text-xs text-foggy mb-1 font-medium uppercase tracking-wide">Session Code</p>
          <p className="text-4xl font-mono font-bold tracking-[0.2em] text-hackberry">{sessionId}</p>
        </div>

        {/* Copyable URL */}
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={joinUrl}
            className="input-field text-sm flex-1 font-mono bg-kazan"
            onFocus={e => e.target.select()}
          />
          <button onClick={handleCopy} className="btn-secondary whitespace-nowrap">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Player list + Pull button */}
        <div className="pt-3 border-t border-black/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-hof">
              <span className="font-bold text-xl text-hackberry">{remotePlayers.length}</span>{' '}
              player{remotePlayers.length !== 1 ? 's' : ''} joined
            </span>

            {remotePlayers.length > 0 && (
              <button onClick={onPull} className="btn-primary">
                Pull {remotePlayers.length} Player{remotePlayers.length !== 1 ? 's' : ''} In
              </button>
            )}
          </div>

          {remotePlayers.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1.5">
              {remotePlayers.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-kazan rounded-xl px-3.5 py-2">
                  <span className="font-medium text-hackberry">{p.name}</span>
                  <span className="text-foggy font-mono text-xs">Skill: {p.skill}</span>
                </div>
              ))}
            </div>
          )}

          {remotePlayers.length === 0 && (
            <p className="text-sm text-foggy text-center py-3">Waiting for players to join...</p>
          )}
        </div>

        {/* End Session */}
        <button
          onClick={onEnd}
          className="w-full text-sm text-rausch hover:text-rausch-dark font-semibold hover:bg-rausch/5 rounded-xl py-2.5 transition-colors border border-rausch/20"
        >
          End Session
        </button>
      </div>
    </div>
  )
}
