import { useState, useRef, useEffect } from 'react'
import useTeamChat from '../hooks/useTeamChat'

interface TeamChatProps {
  sessionId: string
  channel: string
  channelLabel: string
  playerName: string
  readOnly?: boolean
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
  const [showEmojiBar, setShowEmojiBar] = useState(false)

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

  // Group consecutive messages from the same sender
  const isFirstInGroup = (idx: number) => {
    if (idx === 0) return true
    return messages[idx].sender_name !== messages[idx - 1].sender_name
  }

  const isLastInGroup = (idx: number) => {
    if (idx === messages.length - 1) return true
    return messages[idx].sender_name !== messages[idx + 1].sender_name
  }

  // Date separator logic
  const getDateLabel = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const oneDay = 86400000
    if (diff < oneDay && d.getDate() === now.getDate()) return 'TODAY'
    if (diff < oneDay * 2 && d.getDate() === now.getDate() - 1) return 'YESTERDAY'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  }

  const shouldShowDate = (idx: number) => {
    if (idx === 0) return true
    const prev = new Date(messages[idx - 1].sent_at)
    const curr = new Date(messages[idx].sent_at)
    return prev.toDateString() !== curr.toDateString()
  }

  const quickEmojis = ['GG', 'Nice!', "Let's go!", 'Ready', 'One sec', 'lol', '?']

  return (
    <div className="wa-chat w-full overflow-hidden animate-fade-in flex flex-col" style={{ borderRadius: '12px' }}>
      {/* ── Header bar (WhatsApp teal) ── */}
      <div className="wa-header px-4 py-2.5 flex items-center gap-3">
        {/* Group avatar */}
        <div className="wa-avatar w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {channelLabel.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[15px] font-medium truncate leading-tight">
            {channelLabel}
          </p>
          <p className="text-white/60 text-[11px] leading-tight mt-0.5">
            {messages.length} message{messages.length !== 1 && 's'}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowEmojiBar(v => !v)}
            className="text-white/70 hover:text-white transition-colors p-1"
            title="Quick messages"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm3.5-9c.828 0 1.5-.672 1.5-1.5S16.328 8 15.5 8 14 8.672 14 9.5s.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.672 1.5-1.5S9.328 8 8.5 8 7 8.672 7 9.5 7.672 11 8.5 11zm3.5 6.5c2.33 0 4.32-1.45 5.116-3.5H6.884c.796 2.05 2.786 3.5 5.116 3.5z"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Message area with WhatsApp wallpaper ── */}
      <div
        className={`wa-messages overflow-y-auto px-3 py-2 ${
          readOnly ? 'max-h-48' : 'h-96'
        }`}
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="wa-system-pill px-4 py-1.5 rounded-lg text-center">
              <p className="text-[12.5px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Messages are end-to-end encrypted. No one outside of this chat can read them.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOwn = msg.sender_name.toLowerCase() === playerName.toLowerCase()
          const first = isFirstInGroup(idx)
          const last = isLastInGroup(idx)

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {shouldShowDate(idx) && (
                <div className="flex justify-center my-3">
                  <span className="wa-date-pill px-3 py-1 rounded-md text-[11px] font-medium tracking-wide">
                    {getDateLabel(msg.sent_at)}
                  </span>
                </div>
              )}

              <div
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                  first ? 'mt-2' : 'mt-[3px]'
                }`}
              >
                <div
                  className={`wa-bubble relative max-w-[78%] px-2.5 py-1.5 ${
                    isOwn ? 'wa-bubble-out' : 'wa-bubble-in'
                  } ${first ? 'wa-bubble-first' : ''}`}
                  style={{
                    borderRadius: isOwn
                      ? `7.5px ${first ? '0' : '7.5px'} 7.5px 7.5px`
                      : `${first ? '0' : '7.5px'} 7.5px 7.5px 7.5px`,
                  }}
                >
                  {/* Sender name (group chat style, only for others) */}
                  {!isOwn && first && (
                    <p className="wa-sender-name text-[12.5px] font-semibold mb-0.5 leading-tight">
                      {msg.sender_name}
                    </p>
                  )}

                  {/* Message body + timestamp in one line flow */}
                  <div className="flex items-end gap-2">
                    <p className="text-[14.2px] leading-[19px] flex-1" style={{ wordBreak: 'break-word' }}>
                      {msg.body}
                    </p>
                    <span className="wa-timestamp text-[11px] leading-none flex-shrink-0 translate-y-[1px] flex items-center gap-0.5">
                      {formatTime(msg.sent_at)}
                      {/* Double check marks for own messages */}
                      {isOwn && (
                        <svg className="w-[16px] h-[11px] ml-0.5" viewBox="0 0 16 11" fill="none">
                          <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.011-2.175a.46.46 0 00-.313-.153.518.518 0 00-.381.122.465.465 0 00-.15.348.467.467 0 00.152.351l2.34 2.534a.455.455 0 00.33.152c.14 0 .271-.07.354-.178l6.508-8.005a.478.478 0 00.047-.58z" fill="currentColor"/>
                          <path d="M14.757.653a.457.457 0 00-.305-.102.493.493 0 00-.38.178l-6.19 7.636-2.012-2.175a.46.46 0 00-.312-.153.518.518 0 00-.382.122.465.465 0 00-.15.348.467.467 0 00.153.351l2.34 2.534a.455.455 0 00.33.152c.139 0 .27-.07.353-.178l6.509-8.005a.478.478 0 00.046-.58z" fill="currentColor" opacity="0.7"/>
                        </svg>
                      )}
                    </span>
                  </div>

                  {/* WhatsApp-style tail/notch for first message in group */}
                  {first && (
                    <div
                      className={`absolute top-0 w-3 h-3 ${
                        isOwn ? '-right-[5px]' : '-left-[5px]'
                      }`}
                    >
                      <svg
                        viewBox="0 0 8 13"
                        width="8"
                        height="13"
                        className={`absolute top-0 ${isOwn ? 'right-0' : 'left-0 -scale-x-100'}`}
                      >
                        <path
                          d={isOwn
                            ? 'M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z'
                            : 'M6.467 3.568L0 12.193V1h5.188c1.77 0 2.338 1.156 1.28 2.568z'
                          }
                          fill={isOwn ? '#d9fdd3' : '#ffffff'}
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Spacer after last message in a group */}
              {last && <div className="h-0.5" />}
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick emoji bar (toggleable) ── */}
      {!readOnly && showEmojiBar && (
        <div className="wa-emoji-bar px-3 py-2 flex gap-1.5 flex-wrap border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          {quickEmojis.map((q) => (
            <button
              key={q}
              onClick={() => { sendMessage(q); setShowEmojiBar(false) }}
              disabled={isSending}
              className="wa-quick-btn px-3 py-1 text-[12px] font-medium rounded-full transition-all active:scale-95 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      {!readOnly && (
        <div className="wa-input-bar px-2 py-2 flex items-end gap-2">
          {/* Emoji toggle in input area */}
          <button
            onClick={() => setShowEmojiBar(v => !v)}
            className="wa-input-icon p-2 flex-shrink-0"
            title="Quick messages"
          >
            <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.153 11.603c.795 0 1.44-.88 1.44-1.962s-.645-1.962-1.44-1.962c-.795 0-1.44.88-1.44 1.962s.645 1.962 1.44 1.962zm5.694 0c.795 0 1.44-.88 1.44-1.962s-.645-1.962-1.44-1.962c-.795 0-1.44.88-1.44 1.962s.645 1.962 1.44 1.962zM11.994 2c-5.517 0-9.997 4.48-9.997 10s4.48 10 9.997 10C17.52 22 22 17.52 22 12S17.52 2 11.994 2zm.006 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-3.5c-2.33 0-4.32-1.45-5.116-3.5h10.232c-.796 2.05-2.786 3.5-5.116 3.5z"/>
            </svg>
          </button>

          {/* Text input with WhatsApp styling */}
          <div className="wa-input-field flex-1 flex items-end rounded-3xl px-3 py-1.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              className="wa-text-input flex-1 bg-transparent text-[15px] py-1 focus:outline-none"
              style={{ lineHeight: '20px' }}
            />
          </div>

          {/* Send / Mic button */}
          <button
            onClick={draft.trim() ? handleSend : undefined}
            disabled={!draft.trim() || isSending}
            className="wa-send-btn w-[42px] h-[42px] rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-60"
          >
            {draft.trim() ? (
              <svg className="w-5 h-5 text-white ml-[2px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.239 1.816-13.239 1.817-.011 7.912z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.238 6.002s-6.238-2.471-6.238-6.002H4.057c0 4.001 3.178 7.296 7.06 7.885v3.884h1.765v-3.884c3.882-.589 7.06-3.884 7.06-7.885h-1.705z"/>
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
