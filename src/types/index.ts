export interface Participant {
  id: string
  name: string
  skill: number
  excluded: boolean
  lockedTeam: number | null // 0-indexed team number, or null if free
  role?: string
}

export interface Team {
  index: number
  name: string
  members: Participant[]
}

export type TeamNameLanguage = 'en' | 'tr' | 'ar'

export interface BalancerConfig {
  teamCount: number
  maxPerTeam?: number
  nameLanguage?: TeamNameLanguage
}

export interface TeamMetrics {
  teamIndex: number
  teamName: string
  total: number
  average: number
  size: number
  diffFromAvg: number
}

export interface OverallMetrics {
  totalParticipants: number
  totalSkill: number
  avgTeamTotal: number
  spread: number // max team total - min team total
  stdDev: number
  balanceScore: number // 0-100, higher is better
  teamMetrics: TeamMetrics[]
}

export interface ColumnMapping {
  name: string | null
  skill: string | null
  role: string | null
}

export interface ImportPreview {
  headers: string[]
  rows: Record<string, string>[]
  mapping: ColumnMapping
  errors: ImportError[]
}

export interface ImportError {
  row: number
  field: string
  message: string
}

export interface SessionData {
  participants: Participant[]
  config: BalancerConfig
  teams: Team[]
  savedAt: string
}
