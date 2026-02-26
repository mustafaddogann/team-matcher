import { describe, it, expect } from 'vitest'
import { calculateOverallMetrics } from '../utils/metrics'
import type { Team, Participant } from '../types'

function makeMember(name: string, skill: number): Participant {
  return { id: name, name, skill, excluded: false, lockedTeam: null }
}

function makeTeam(index: number, members: Participant[]): Team {
  return { index, name: `Team ${index + 1}`, members }
}

describe('calculateOverallMetrics', () => {
  it('calculates perfect balance score for equal teams', () => {
    const teams = [
      makeTeam(0, [makeMember('A', 50), makeMember('B', 50)]),
      makeTeam(1, [makeMember('C', 50), makeMember('D', 50)]),
    ]

    const metrics = calculateOverallMetrics(teams)
    expect(metrics.balanceScore).toBe(100)
    expect(metrics.spread).toBe(0)
    expect(metrics.stdDev).toBe(0)
    expect(metrics.totalParticipants).toBe(4)
    expect(metrics.totalSkill).toBe(200)
  })

  it('calculates lower score for imbalanced teams', () => {
    const teams = [
      makeTeam(0, [makeMember('A', 90), makeMember('B', 80)]),
      makeTeam(1, [makeMember('C', 40), makeMember('D', 30)]),
    ]

    const metrics = calculateOverallMetrics(teams)
    expect(metrics.balanceScore).toBeLessThan(100)
    expect(metrics.spread).toBe(100)
    expect(metrics.stdDev).toBeGreaterThan(0)
  })

  it('computes correct team metrics', () => {
    const teams = [
      makeTeam(0, [makeMember('A', 80), makeMember('B', 70)]),
      makeTeam(1, [makeMember('C', 60), makeMember('D', 50)]),
    ]

    const metrics = calculateOverallMetrics(teams)
    expect(metrics.teamMetrics).toHaveLength(2)

    const tm0 = metrics.teamMetrics[0]
    expect(tm0.total).toBe(150)
    expect(tm0.average).toBe(75)
    expect(tm0.size).toBe(2)

    const tm1 = metrics.teamMetrics[1]
    expect(tm1.total).toBe(110)
    expect(tm1.average).toBe(55)

    // Avg team total = 130
    expect(tm0.diffFromAvg).toBe(20)
    expect(tm1.diffFromAvg).toBe(-20)
  })

  it('handles empty teams', () => {
    const teams = [
      makeTeam(0, [makeMember('A', 100)]),
      makeTeam(1, []),
    ]

    const metrics = calculateOverallMetrics(teams)
    expect(metrics.totalParticipants).toBe(1)
    expect(metrics.spread).toBe(100)
  })

  it('handles all-zero skills', () => {
    const teams = [
      makeTeam(0, [makeMember('A', 0), makeMember('B', 0)]),
      makeTeam(1, [makeMember('C', 0), makeMember('D', 0)]),
    ]

    const metrics = calculateOverallMetrics(teams)
    expect(metrics.balanceScore).toBe(100)
    expect(metrics.spread).toBe(0)
  })
})
