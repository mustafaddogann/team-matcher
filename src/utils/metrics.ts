import type { Team, TeamMetrics, OverallMetrics } from '../types'

function teamTotal(team: Team): number {
  return team.members.reduce((sum, p) => sum + p.skill, 0)
}

export function calculateTeamMetrics(team: Team, avgTeamTotal: number): TeamMetrics {
  const total = teamTotal(team)
  return {
    teamIndex: team.index,
    teamName: team.name,
    total,
    average: team.members.length > 0 ? total / team.members.length : 0,
    size: team.members.length,
    diffFromAvg: total - avgTeamTotal,
  }
}

export function calculateOverallMetrics(teams: Team[]): OverallMetrics {
  const totalParticipants = teams.reduce((sum, t) => sum + t.members.length, 0)
  const totalSkill = teams.reduce((sum, t) => sum + teamTotal(t), 0)
  const avgTeamTotal = teams.length > 0 ? totalSkill / teams.length : 0

  const teamMetrics = teams.map(t => calculateTeamMetrics(t, avgTeamTotal))
  const totals = teamMetrics.map(m => m.total)

  const spread = totals.length > 0 ? Math.max(...totals) - Math.min(...totals) : 0

  const variance =
    totals.length > 0
      ? totals.reduce((sum, t) => sum + Math.pow(t - avgTeamTotal, 2), 0) / totals.length
      : 0
  const stdDev = Math.sqrt(variance)

  // Balance score: 100 means perfect, decreases as spread grows relative to avg
  const balanceScore =
    avgTeamTotal > 0
      ? Math.max(0, Math.round(100 - (spread / avgTeamTotal) * 100))
      : teams.length > 0 && totalSkill === 0
        ? 100
        : 0

  return {
    totalParticipants,
    totalSkill,
    avgTeamTotal,
    spread,
    stdDev,
    balanceScore,
    teamMetrics,
  }
}
