import type { Participant, BalancerConfig } from '../types'

export interface ValidationError {
  field: string
  message: string
  participantId?: string
}

export function validateParticipants(
  participants: Participant[],
  config: BalancerConfig,
): ValidationError[] {
  const errors: ValidationError[] = []

  const active = participants.filter(p => !p.excluded)

  if (active.length < config.teamCount) {
    errors.push({
      field: 'participants',
      message: `Need at least ${config.teamCount} active participants for ${config.teamCount} teams (have ${active.length})`,
    })
  }

  for (const p of participants) {
    if (!p.name.trim()) {
      errors.push({
        field: 'name',
        message: 'Name is required',
        participantId: p.id,
      })
    }

    if (isNaN(p.skill) || p.skill < 0) {
      errors.push({
        field: 'skill',
        message: `Invalid skill value for "${p.name || '(unnamed)'}"`,
        participantId: p.id,
      })
    }

    if (p.lockedTeam !== null && (p.lockedTeam < 0 || p.lockedTeam >= config.teamCount)) {
      errors.push({
        field: 'lockedTeam',
        message: `"${p.name}" is locked to team ${p.lockedTeam + 1} but only ${config.teamCount} teams exist`,
        participantId: p.id,
      })
    }
  }

  return errors
}

export function validateSkillInput(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const num = Number(trimmed)
  if (isNaN(num) || num < 0) return null
  return num
}
