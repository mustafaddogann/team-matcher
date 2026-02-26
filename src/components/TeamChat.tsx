import { useState, useRef, useEffect } from 'react'
import useTeamChat from '../hooks/useTeamChat'

interface TeamChatProps {
  sessionId: string
  channel: string
  channelLabel: string
  playerName: string
  readOnly?: boolean
}

// Deterministic color from username (Discord-style role colors)
const NAME_COLORS = [
  '#f23f43', '#fe7334', '#f0b232', '#2dc770',
  '#45ddc0', '#39a4f4', '#8a8ff8', '#e985e3',
]
function nameColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
}

function avatarInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

export default function TeamChat({
  sessionId,
  channel,
  channelLabel,
  playerName,
  readOnly = false,
}: TeamChatProps) {
  const { messages, sendMessage, isSending } = useTeamChat(
    sessionId,
    channel,
    playerName,
  )
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showQuickBar, setShowQuickBar] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = () => {
    if (!draft.trim()) return
    sendMessage(draft)
    setDraft('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isFirstInGroup = (idx: number) => {
    if (idx === 0) return true
    return messages[idx].sender_name !== messages[idx - 1].sender_name
  }

  const getDateLabel = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const oneDay = 86400000
    if (diff < oneDay && d.getDate() === now.getDate()) return 'Today'
    if (diff < oneDay * 2 && d.getDate() === now.getDate() - 1) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const shouldShowDate = (idx: number) => {
    if (idx === 0) return true
    const prev = new Date(messages[idx - 1].sent_at)
    const curr = new Date(messages[idx].sent_at)
    return prev.toDateString() !== curr.toDateString()
  }

  const quickMessages = ['GG', 'Nice!', "Let's go!", 'Ready', 'One sec', 'lol', '?']

  return (
    <div className="dc-chat w-full overflow-hidden animate-fade-in flex flex-col rounded-lg">
      {/* ── Header ── */}
      <div className="dc-header px-4 py-2.5 flex items-center gap-2">
        <svg className="w-5 h-5 dc-hash-icon flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z" />
        </svg>
        <span className="dc-channel-name text-[15px] font-semibold truncate">
          {channelLabel}
        </span>
      </div>

      {/* ── Messages ── */}
      <div
        className={`dc-messages overflow-y-auto px-4 py-2 ${
          readOnly ? 'max-h-48' : 'h-80'
        }`}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="dc-empty-icon w-16 h-16 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" opacity="0.4">
                <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z" />
              </svg>
            </div>
            <p className="dc-empty-title text-[17px] font-bold">
              Welcome to #{channelLabel}!
            </p>
            <p className="dc-empty-subtitle text-[13px]">
              This is the start of the #{channelLabel} channel.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const first = isFirstInGroup(idx)
          const color = nameColor(msg.sender_name)

          return (
            <div key={msg.id}>
              {/* Date divider */}
              {shouldShowDate(idx) && (
                <div className="dc-divider flex items-center my-4">
                  <div className="dc-divider-line flex-1 h-px" />
                  <span className="dc-divider-text px-2 text-[11px] font-semibold">
                    {getDateLabel(msg.sent_at)}
                  </span>
                  <div className="dc-divider-line flex-1 h-px" />
                </div>
              )}

              <div className={`dc-msg group flex gap-3 px-1 rounded ${first ? 'mt-3 pt-0.5' : ''}`}>
                {/* Avatar or spacer */}
                {first ? (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: color }}
                  >
                    {avatarInitial(msg.sender_name)}
                  </div>
                ) : (
                  <div className="w-10 flex-shrink-0 flex items-center justify-center">
                    <span className="dc-hover-time text-[10px] hidden group-hover:block">
                      {formatTime(msg.sent_at)}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* Username + timestamp */}
                  {first && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span
                        className="text-[14px] font-semibold hover:underline cursor-pointer"
                        style={{ color }}
                      >
                        {msg.sender_name}
                      </span>
                      <span className="dc-timestamp text-[11px]">
                        {formatTime(msg.sent_at)}
                      </span>
                    </div>
                  )}

                  {/* Message body */}
                  <p className="dc-body text-[15px] leading-[1.375]" style={{ wordBreak: 'break-word' }}>
                    {msg.body}
                  </p>
                </div>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick messages bar ── */}
      {!readOnly && showQuickBar && (
        <div className="dc-quick-bar px-3 py-2 flex gap-1.5 flex-wrap">
          {quickMessages.map((q) => (
            <button
              key={q}
              onClick={() => { sendMessage(q); setShowQuickBar(false) }}
              disabled={isSending}
              className="dc-quick-btn px-3 py-1 text-[12px] font-medium rounded transition-all active:scale-95 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      {!readOnly && (
        <div className="dc-input-bar px-3 pb-3 pt-0">
          <div className="dc-input-field flex items-center rounded-lg px-3">
            <button
              onClick={() => setShowQuickBar(v => !v)}
              className="dc-input-icon p-1.5 rounded flex-shrink-0 mr-1"
              title="Quick messages"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm3.5-9c.828 0 1.5-.672 1.5-1.5S16.328 8 15.5 8 14 8.672 14 9.5s.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.672 1.5-1.5S9.328 8 8.5 8 7 8.672 7 9.5 7.672 11 8.5 11zm3.5 6.5c2.33 0 4.32-1.45 5.116-3.5H6.884c.796 2.05 2.786 3.5 5.116 3.5z"/>
              </svg>
            </button>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${channelLabel}`}
              className="dc-text-input flex-1 bg-transparent text-[15px] py-2.5 focus:outline-none"
            />
            {draft.trim() && (
              <button
                onClick={handleSend}
                disabled={isSending}
                className="dc-send-btn p-1.5 rounded flex-shrink-0 ml-1 transition-all active:scale-90 disabled:opacity-40"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.239 1.816-13.239 1.817-.011 7.912z"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
