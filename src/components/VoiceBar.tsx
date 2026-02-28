import useVoiceChat from '../hooks/useVoiceChat'

interface VoiceBarProps {
  sessionId: string
  channel: string
  channelLabel: string
  playerName: string
}

export default function VoiceBar({ sessionId, channel, channelLabel, playerName }: VoiceBarProps) {
  const {
    isConnected,
    isConnecting,
    isSwitching,
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

  const buttonLabel = isSwitching
    ? 'Switching...'
    : isConnecting
      ? 'Joining...'
      : 'Join Voice'

  return (
    <div className="tm-voice-dock mt-3 flex-shrink-0 rounded-[24px] border border-white/[0.08] bg-[#0b1226]/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/25">
            Voice
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{channelLabel}</p>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/45">
              {participants.length} in room
            </span>
          </div>
          <p className="mt-1 text-[12px] text-white/35">
            {isConnected ? 'You only hear this channel.' : `Join ${channelLabel} voice.`}
          </p>
        </div>

        {!isConnected ? (
          <button
            onClick={joinVoice}
            disabled={isConnecting || isSwitching}
            className="btn-primary whitespace-nowrap"
          >
            {buttonLabel}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              disabled={isSwitching}
              className={`rounded-full p-2 transition-colors disabled:opacity-50 ${
                isMicMuted
                  ? 'bg-rausch/12 text-rausch hover:bg-rausch/20'
                  : 'bg-babu/12 text-babu hover:bg-babu/20'
              }`}
              title={isMicMuted ? 'Unmute mic' : 'Mute mic'}
            >
              {isMicMuted ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleDeafen}
              disabled={isSwitching}
              className={`rounded-full p-2 transition-colors disabled:opacity-50 ${
                isDeafened
                  ? 'bg-rausch/12 text-rausch hover:bg-rausch/20'
                  : 'bg-babu/12 text-babu hover:bg-babu/20'
              }`}
              title={isDeafened ? 'Enable speaker' : 'Mute speaker'}
            >
              {isDeafened ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            <button
              onClick={leaveVoice}
              disabled={isSwitching}
              className="rounded-full bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:bg-white/[0.12]"
            >
              Leave
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-rausch/80">{error}</p>
      )}

      {isSwitching && (
        <p className="mt-3 text-xs text-white/45">
          Switching room, stay on this screen.
        </p>
      )}

      {participants.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {participants.map((participant) => (
            <span
              key={participant.identity}
              className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                participant.isSpeaking
                  ? 'border-babu/30 bg-babu/20 text-white'
                  : 'border-white/[0.08] bg-white/[0.04] text-white/60'
              }`}
            >
              {participant.identity}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
