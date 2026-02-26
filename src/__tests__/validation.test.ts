import { describe, it, expect } from 'vitest'
import { validateParticipants, validateSkillInput } from '../utils/validation'
import type { Participant } from '../types'

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: 'test-1',
    name: 'Test Player',
    skill: 50,
    excluded: false,
    lockedTeam: null,
    ...overrides,
  }
}

describe('validateParticipants', () => {
  it('returns no errors for valid participants', () => {
    const participants = [
      makeParticipant({ id: '1', name: 'Alice', skill: 80 }),
      makeParticipant({ id: '2', name: 'Bob', skill: 70 }),
    ]
    const errors = validateParticipants(participants, { teamCount: 2 })
    expect(errors).toHaveLength(0)
  })

  it('errors when not enough participants for teams', () => {
    const participants = [makeParticipant({ id: '1', name: 'Alice' })]
    const errors = validateParticipants(participants, { teamCount: 3 })
    expect(errors.some(e => e.field === 'participants')).toBe(true)
  })

  it('errors on empty name', () => {
    const participants = [
      makeParticipant({ id: '1', name: '' }),
      makeParticipant({ id: '2', name: 'Bob' }),
    ]
    const errors = validateParticipants(participants, { teamCount: 2 })
    expect(errors.some(e => e.field === 'name')).toBe(true)
  })

  it('errors on negative skill', () => {
    const participants = [
      makeParticipant({ id: '1', name: 'Alice', skill: -5 }),
      makeParticipant({ id: '2', name: 'Bob', skill: 50 }),
    ]
    const errors = validateParticipants(participants, { teamCount: 2 })
    expect(errors.some(e => e.field === 'skill')).toBe(true)
  })

  it('errors on invalid locked team', () => {
    const participants = [
      makeParticipant({ id: '1', name: 'Alice', lockedTeam: 5 }),
      makeParticipant({ id: '2', name: 'Bob' }),
    ]
    const errors = validateParticipants(participants, { teamCount: 2 })
    expect(errors.some(e => e.field === 'lockedTeam')).toBe(true)
  })

  it('excludes excluded participants from team count check', () => {
    const participants = [
      makeParticipant({ id: '1', name: 'Alice', excluded: true }),
      makeParticipant({ id: '2', name: 'Bob' }),
    ]
    const errors = validateParticipants(participants, { teamCount: 2 })
    expect(errors.some(e => e.field === 'participants')).toBe(true)
  })
})

describe('validateSkillInput', () => {
  it('parses valid numbers', () => {
    expect(validateSkillInput('50')).toBe(50)
    expect(validateSkillInput(' 85 ')).toBe(85)
    expect(validateSkillInput('0')).toBe(0)
  })

  it('returns null for empty string', () => {
    expect(validateSkillInput('')).toBeNull()
    expect(validateSkillInput('  ')).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(validateSkillInput('abc')).toBeNull()
    expect(validateSkillInput('12abc')).toBeNull()
  })

  it('returns null for negative numbers', () => {
    expect(validateSkillInput('-5')).toBeNull()
  })
})
