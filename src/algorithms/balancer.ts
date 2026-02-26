import type { Participant, Team, BalancerConfig } from '../types'
import { getRandomTeamNames } from '../data/teamNames'

function teamTotal(team: Team): number {
  return team.members.reduce((sum, p) => sum + p.skill, 0)
}

function cloneTeams(teams: Team[]): Team[] {
  return teams.map(t => ({
    ...t,
    members: [...t.members],
  }))
}

/**
 * Balance participants into teams using greedy snake draft + local optimization.
 *
 * 1. Separate excluded, locked, and free participants
 * 2. Place locked participants into their assigned teams
 * 3. Snake draft: sort free by skill desc, assign each to weakest team
 * 4. Local optimization: try swaps between team pairs, accept improvements
 */
export function balanceTeams(
  participants: Participant[],
  config: BalancerConfig,
): Team[] {
  const { teamCount } = config
  const maxPerTeam = config.maxPerTeam ?? Math.ceil(participants.length / teamCount)

  // Create empty teams with curated names
  const names = getRandomTeamNames(config.nameLanguage ?? 'en', teamCount)
  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    index: i,
    name: names[i],
    members: [],
  }))

  // Separate participants
  const excluded = participants.filter(p => p.excluded)
  const locked = participants.filter(p => !p.excluded && p.lockedTeam !== null)
  const free = participants.filter(p => !p.excluded && p.lockedTeam === null)

  // Mark excluded as not placed (they stay out)
  void excluded

  // Place locked participants
  for (const p of locked) {
    const teamIdx = p.lockedTeam!
    if (teamIdx >= 0 && teamIdx < teamCount) {
      teams[teamIdx].members.push(p)
    }
  }

  // Snake draft: sort free participants by skill descending
  const sorted = [...free].sort((a, b) => b.skill - a.skill)

  for (const p of sorted) {
    // Find team with lowest total that still has room
    let bestTeam: Team | null = null
    let bestTotal = Infinity

    for (const team of teams) {
      if (team.members.length < maxPerTeam && teamTotal(team) < bestTotal) {
        bestTotal = teamTotal(team)
        bestTeam = team
      }
    }

    // If all teams at max, find any team with lowest total
    if (!bestTeam) {
      for (const team of teams) {
        if (teamTotal(team) < bestTotal) {
          bestTotal = teamTotal(team)
          bestTeam = team
        }
      }
    }

    bestTeam!.members.push(p)
  }

  // Local optimization: swap/move to reduce spread
  return optimizeTeams(teams, maxPerTeam)
}

function getSpread(teams: Team[]): number {
  const totals = teams.map(teamTotal)
  return Math.max(...totals) - Math.min(...totals)
}

function optimizeTeams(teams: Team[], maxPerTeam: number): Team[] {
  let best = cloneTeams(teams)
  let bestSpread = getSpread(best)
  let improved = true
  let iterations = 0

  while (improved && iterations < 500) {
    improved = false
    iterations++

    // Try swaps between each pair of teams
    for (let i = 0; i < best.length && !improved; i++) {
      for (let j = i + 1; j < best.length && !improved; j++) {
        const teamA = best[i]
        const teamB = best[j]

        // Try swapping each pair of free members
        for (let a = 0; a < teamA.members.length && !improved; a++) {
          if (teamA.members[a].lockedTeam !== null) continue

          for (let b = 0; b < teamB.members.length && !improved; b++) {
            if (teamB.members[b].lockedTeam !== null) continue

            // Swap
            const candidate = cloneTeams(best)
            const memA = candidate[i].members[a]
            const memB = candidate[j].members[b]
            candidate[i].members[a] = memB
            candidate[j].members[b] = memA

            const newSpread = getSpread(candidate)
            if (newSpread < bestSpread) {
              best = candidate
              bestSpread = newSpread
              improved = true
            }
          }
        }

        // Try moving a free member from larger-total team to smaller-total
        if (!improved) {
          const [srcIdx, dstIdx] = teamTotal(teamA) > teamTotal(teamB) ? [i, j] : [j, i]
          const src = best[srcIdx]
          const dst = best[dstIdx]

          if (dst.members.length < maxPerTeam) {
            for (let m = 0; m < src.members.length && !improved; m++) {
              if (src.members[m].lockedTeam !== null) continue
              if (src.members.length <= 1) continue

              const candidate = cloneTeams(best)
              const [moved] = candidate[srcIdx].members.splice(m, 1)
              candidate[dstIdx].members.push(moved)

              const newSpread = getSpread(candidate)
              if (newSpread < bestSpread) {
                best = candidate
                bestSpread = newSpread
                improved = true
              }
            }
          }
        }
      }
    }
  }

  return best
}
