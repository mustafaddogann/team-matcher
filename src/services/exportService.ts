import type { Team } from '../types'

export function teamsToCSV(teams: Team[]): string {
  const lines = ['Team,Name,Skill,Role']

  for (const team of teams) {
    for (const member of team.members) {
      const name = member.name.includes(',') ? `"${member.name}"` : member.name
      lines.push(`${team.name},${name},${member.skill},${member.role ?? ''}`)
    }
  }

  return lines.join('\n')
}

export function teamsToText(teams: Team[]): string {
  const parts: string[] = []

  for (const team of teams) {
    const total = team.members.reduce((sum, m) => sum + m.skill, 0)
    const avg = team.members.length > 0 ? (total / team.members.length).toFixed(1) : '0'
    parts.push(`${team.name} (Total: ${total}, Avg: ${avg})`)
    parts.push('─'.repeat(40))

    for (const member of team.members) {
      const role = member.role ? ` [${member.role}]` : ''
      parts.push(`  ${member.name} — ${member.skill}${role}`)
    }
    parts.push('')
  }

  return parts.join('\n')
}

export function downloadCSV(teams: Team[], filename = 'teams.csv'): void {
  const csv = teamsToCSV(teams)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(teams: Team[]): Promise<void> {
  const text = teamsToText(teams)
  await navigator.clipboard.writeText(text)
}
