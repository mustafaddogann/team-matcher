import { useState, useRef, useEffect, useCallback } from 'react'
import useTeamChat from '../hooks/useTeamChat'

interface TeamChatProps {
  sessionId: string
  channel: string
  channelLabel: string
  playerName: string
  readOnly?: boolean
}

// Deterministic color from username
const NAME_COLORS = [
  '#f23f43', '#fe7334', '#f0b232', '#2dc770',
  '#45ddc0', '#39a4f4', '#8a8ff8', '#e985e3',
]
function nameColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showQuickBar, setShowQuickBar] = useState(false)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // Scroll to bottom on new messages and on mount
  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // Also scroll after layout settles (images, fonts, etc.)
  useEffect(() => {
    const t = setTimeout(scrollToBottom, 100)
    return () => clearTimeout(t)
  }, [channel, scrollToBottom])

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
    <div className="dc-chat w-full overflow-hidden flex flex-col h-full">
      {/* ── Messages — anchored to bottom ── */}
      <div
        ref={scrollRef}
        className={`dc-messages overflow-y-auto px-4 ${
          readOnly ? 'max-h-48' : 'flex-1 min-h-0'
        }`}
      >
        <div className="dc-messages-inner-wrap">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="dc-empty-subtitle text-[13px]">
                No messages yet in #{channelLabel}
              </p>
            </div>
          ) : (
            <div className="dc-messages-inner pb-2">
              {messages.map((msg, idx) => {
                const first = isFirstInGroup(idx)
                const color = nameColor(msg.sender_name)

                return (
                  <div key={msg.id}>
                    {/* Date divider */}
                    {shouldShowDate(idx) && (
                      <div className="dc-divider flex items-center my-3">
                        <div className="dc-divider-line flex-1 h-px" />
                        <span className="dc-divider-text px-2 text-[10px] font-semibold">
                          {getDateLabel(msg.sent_at)}
                        </span>
                        <div className="dc-divider-line flex-1 h-px" />
                      </div>
                    )}

                    <div className={`dc-msg group px-2 py-0.5 rounded ${first ? 'mt-2' : ''}`}>
                      {first && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-[13px] font-semibold" style={{ color }}>
                            {msg.sender_name}
                          </span>
                          <span className="dc-timestamp text-[10px]">
                            {formatTime(msg.sent_at)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-baseline gap-2">
                        {!first && (
                          <span className="dc-hover-time text-[10px] hidden group-hover:inline flex-shrink-0 w-10 text-right">
                            {formatTime(msg.sent_at)}
                          </span>
                        )}
                        <p className="dc-body text-[14.5px] leading-[1.4]" style={{ wordBreak: 'break-word' }}>
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick messages bar ── */}
      {!readOnly && showQuickBar && (
        <div className="dc-quick-bar px-3 py-1.5 flex gap-1.5 flex-wrap">
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

      {/* ── Input — always pinned at bottom ── */}
      {!readOnly && (
        <div className="dc-input-bar px-3 pb-2 pt-1 flex-shrink-0">
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
