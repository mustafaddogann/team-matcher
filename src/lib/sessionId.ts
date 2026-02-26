// Omit 0/O/1/I to avoid confusion
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateSessionId(): string {
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return id
}

export function isValidSessionId(id: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(id)
}
