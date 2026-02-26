import { useState } from 'react'

interface HeaderProps {
  onSave: (name: string) => void
  onLoad: (name: string) => boolean
  getSessions: () => string[]
  onClearAll: () => void
  onNewSession: (name: string) => void
  onDeleteSession: (name: string) => void
  activeSessionName: string | null
  isLive?: boolean
  onStartLive?: () => void
  onShowShare?: () => void
  remotePlayerCount?: number
}

export default function Header({
  onSave,
  onLoad,
  getSessions,
  onClearAll,
  onNewSession,
  onDeleteSession,
  activeSessionName,
  isLive,
  onStartLive,
  onShowShare,
  remotePlayerCount = 0,
}: HeaderProps) {
  const [showSessions, setShowSessions] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const sessions = showSessions ? getSessions() : []

  return (
    <header className="glass border-b border-black/[0.06] sticky top-0 z-40">
      <div className="mx-auto px-4 py-3.5 sm:px-6 lg:px-10 xl:px-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-tight">
              <span className="text-hackberry">Team</span><span className="text-gradient">Matcher</span>
            </h1>
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-babu bg-babu/8 border border-babu/15 px-2.5 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-babu opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-babu" />
                </span>
                LIVE
              </span>
            )}
            {activeSessionName ? (
              <span className="hidden sm:inline text-sm text-foggy font-medium">{activeSessionName}</span>
            ) : (
              <span className="hidden sm:inline text-sm text-foggy/50">Unsaved session</span>
            )}
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-2">
            {!isLive && (
              <button onClick={onStartLive} className="btn-primary">
                Start Live Session
              </button>
            )}
            {isLive && (
              <button
                onClick={onShowShare}
                className="btn-primary relative"
              >
                Live Session
                {remotePlayerCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-hackberry text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-airbnb-md">
                    {remotePlayerCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="btn-secondary"
            >
              Sessions
            </button>
            <button onClick={onClearAll} className="btn-danger">
              Clear All
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-foggy hover:text-hackberry transition-colors rounded-xl hover:bg-kazan"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden mt-3 pt-3 border-t border-black/[0.06] space-y-2 animate-fade-in">
            {activeSessionName && (
              <p className="text-sm text-foggy font-medium mb-2">{activeSessionName}</p>
            )}
            <div className="flex flex-col gap-2">
              {!isLive && (
                <button onClick={() => { onStartLive?.(); setMobileMenuOpen(false) }} className="btn-primary w-full">
                  Start Live Session
                </button>
              )}
              {isLive && (
                <button onClick={() => { onShowShare?.(); setMobileMenuOpen(false) }} className="btn-primary w-full relative">
                  Live Session
                  {remotePlayerCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-hackberry text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {remotePlayerCount}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => { setShowSessions(!showSessions); setMobileMenuOpen(false) }}
                className="btn-secondary w-full"
              >
                Sessions
              </button>
              <button onClick={() => { onClearAll(); setMobileMenuOpen(false) }} className="btn-danger w-full">
                Clear All
              </button>
            </div>
          </div>
        )}

        {showSessions && (
          <div className="mt-3 p-4 bg-kazan/80 rounded-2xl border border-black/[0.06] space-y-3 animate-fade-in">
            {/* Save current + New session */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                placeholder="Session name..."
                className="input-field text-sm flex-1"
              />
              <button
                onClick={() => {
                  if (sessionName.trim()) {
                    onSave(sessionName.trim())
                    setSessionName('')
                  }
                }}
                disabled={!sessionName.trim()}
                className="btn-primary"
              >
                Save
              </button>
              <button
                onClick={() => {
                  if (sessionName.trim()) {
                    onNewSession(sessionName.trim())
                    setSessionName('')
                  }
                }}
                disabled={!sessionName.trim()}
                className="btn-secondary"
              >
                + New
              </button>
            </div>

            {/* Saved sessions list */}
            {sessions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sessions.map(name => (
                  <div
                    key={name}
                    className={`group flex items-center rounded-full border transition-all duration-200 ${
                      name === activeSessionName
                        ? 'bg-hackberry border-hackberry shadow-airbnb-md'
                        : 'bg-white border-hackberry/[0.1] hover:border-hackberry/30 hover:shadow-airbnb-border'
                    }`}
                  >
                    <button
                      onClick={() => onLoad(name)}
                      className={`text-sm pl-3.5 pr-2 py-1.5 font-medium ${
                        name === activeSessionName
                          ? 'text-white'
                          : 'text-hof'
                      }`}
                    >
                      {name}
                    </button>
                    <button
                      onClick={() => onDeleteSession(name)}
                      className={`mr-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                        name === activeSessionName
                          ? 'text-white/60 hover:text-white hover:bg-white/20'
                          : 'text-foggy hover:text-rausch hover:bg-rausch/10'
                      }`}
                      title={`Delete "${name}"`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foggy">No saved sessions</p>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
