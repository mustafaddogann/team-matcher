import { describe, it, expect } from 'vitest'
import { balanceTeams } from '../algorithms/balancer'
import type { Participant } from '../types'

function makeParticipant(name: string, skill: number, overrides?: Partial<Participant>): Participant {
  return {
    id: `test-${name}`,
    name,
    skill,
    excluded: false,
    lockedTeam: null,
    ...overrides,
  }
}

describe('balanceTeams', () => {
  it('splits 10 players into 2 balanced teams', () => {
    const players = [
      makeParticipant('A', 90), makeParticipant('B', 85),
      makeParticipant('C', 80), makeParticipant('D', 75),
      makeParticipant('E', 70), makeParticipant('F', 65),
      makeParticipant('G', 60), makeParticipant('H', 55),
      makeParticipant('I', 50), makeParticipant('J', 45),
    ]

    const teams = balanceTeams(players, { teamCount: 2 })
    expect(teams).toHaveLength(2)

    const totals = teams.map(t => t.members.reduce((s, m) => s + m.skill, 0))
    const spread = Math.max(...totals) - Math.min(...totals)
    expect(spread).toBeLessThanOrEqual(10)

    // All 10 players assigned
    const totalMembers = teams.reduce((s, t) => s + t.members.length, 0)
    expect(totalMembers).toBe(10)
  })

  it('splits 17 players into 3 teams', () => {
    const players = Array.from({ length: 17 }, (_, i) =>
      makeParticipant(`P${i}`, 50 + i * 3),
    )

    const teams = balanceTeams(players, { teamCount: 3 })
    expect(teams).toHaveLength(3)

    const totalMembers = teams.reduce((s, t) => s + t.members.length, 0)
    expect(totalMembers).toBe(17)

    // Sizes should differ by at most 1
    const sizes = teams.map(t => t.members.length)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })

  it('handles 32 players across 4 teams', () => {
    const players = Array.from({ length: 32 }, (_, i) =>
      makeParticipant(`P${i}`, 40 + i * 2),
    )

    const teams = balanceTeams(players, { teamCount: 4 })
    expect(teams).toHaveLength(4)

    const totals = teams.map(t => t.members.reduce((s, m) => s + m.skill, 0))
    const spread = Math.max(...totals) - Math.min(...totals)
    // Should be well-balanced
    expect(spread).toBeLessThanOrEqual(20)
  })

  it('respects locked assignments', () => {
    const players = [
      makeParticipant('Locked1', 90, { lockedTeam: 0 }),
      makeParticipant('Locked2', 85, { lockedTeam: 1 }),
      makeParticipant('C', 80), makeParticipant('D', 75),
      makeParticipant('E', 70), makeParticipant('F', 65),
    ]

    const teams = balanceTeams(players, { teamCount: 2 })
    expect(teams[0].members.some(m => m.name === 'Locked1')).toBe(true)
    expect(teams[1].members.some(m => m.name === 'Locked2')).toBe(true)
  })

  it('excludes players marked as excluded', () => {
    const players = [
      makeParticipant('A', 90), makeParticipant('B', 85),
      makeParticipant('C', 80, { excluded: true }),
      makeParticipant('D', 75), makeParticipant('E', 70),
    ]

    const teams = balanceTeams(players, { teamCount: 2 })
    const allMembers = teams.flatMap(t => t.members)
    expect(allMembers).toHaveLength(4)
    expect(allMembers.every(m => m.name !== 'C')).toBe(true)
  })

  it('handles equal skill values', () => {
    const players = Array.from({ length: 6 }, (_, i) =>
      makeParticipant(`P${i}`, 50),
    )

    const teams = balanceTeams(players, { teamCount: 2 })
    const totals = teams.map(t => t.members.reduce((s, m) => s + m.skill, 0))
    expect(totals[0]).toBe(totals[1])
  })

  it('handles minimum participants', () => {
    const players = [
      makeParticipant('A', 80),
      makeParticipant('B', 70),
    ]

    const teams = balanceTeams(players, { teamCount: 2 })
    expect(teams).toHaveLength(2)
    expect(teams[0].members).toHaveLength(1)
    expect(teams[1].members).toHaveLength(1)
  })
})
