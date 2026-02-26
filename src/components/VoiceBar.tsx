import useVoiceChat from '../hooks/useVoiceChat'

interface VoiceBarProps {
  sessionId: string
  channel: string
  playerName: string
}

export default function VoiceBar({ sessionId, channel, playerName }: VoiceBarProps) {
  const {
    isConnected,
    isConnecting,
    isMicMuted,
    isDeafened,
    participants,
    error,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
    enabled,
  } = useVoiceChat(sessionId, channel, playerName)

  if (!enabled) return null

  return (
    <div className="rounded-xl border border-black/[0.06] p-3 bg-kazan">
      {error && (
        <p className="text-xs text-rausch mb-2">{error}</p>
      )}

      {!isConnected ? (
        <button
          onClick={joinVoice}
          disabled={isConnecting}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-babu text-white text-sm font-semibold hover:bg-babu/90 transition-colors disabled:opacity-50 mx-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {isConnecting ? 'Joining...' : 'Join Voice'}
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Participant pills */}
          {participants.map((p) => (
            <span
              key={p.identity}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                p.isSpeaking
                  ? 'bg-babu text-white ring-2 ring-babu/30'
                  : 'bg-white text-hof border border-black/[0.08]'
              }`}
            >
              {p.identity}
            </span>
          ))}

          <div className="ml-auto flex items-center gap-1.5">
            {/* Mic toggle */}
            <button
              onClick={toggleMic}
              className={`p-2 rounded-full transition-colors ${
                isMicMuted
                  ? 'bg-rausch/10 text-rausch hover:bg-rausch/20'
                  : 'bg-babu/10 text-babu hover:bg-babu/20'
              }`}
              title={isMicMuted ? 'Unmute mic' : 'Mute mic'}
            >
              {isMicMuted ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* Deafen toggle (incoming audio) */}
            <button
              onClick={toggleDeafen}
              className={`p-2 rounded-full transition-colors ${
                isDeafened
                  ? 'bg-rausch/10 text-rausch hover:bg-rausch/20'
                  : 'bg-babu/10 text-babu hover:bg-babu/20'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>

            {/* Leave button */}
            <button
              onClick={leaveVoice}
              className="px-3 py-1.5 rounded-full bg-rausch text-white text-xs font-semibold hover:bg-rausch-dark transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
