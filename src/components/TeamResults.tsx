import type { Team } from '../types'
import TeamCard from './TeamCard'

interface TeamResultsProps {
  teams: Team[]
  autoTeams: Team[]
  onMove: (participantId: string, fromTeam: number, toTeam: number) => void
  onRename: (teamIndex: number, newName: string) => void
  onReset: () => void
}

export default function TeamResults({ teams, autoTeams, onMove, onRename, onReset }: TeamResultsProps) {
  if (teams.length === 0) return null

  const totalSkill = teams.reduce(
    (sum, t) => sum + t.members.reduce((s, m) => s + m.skill, 0),
    0,
  )
  const avgTotal = totalSkill / teams.length

  const hasManualChanges = JSON.stringify(teams) !== JSON.stringify(autoTeams)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-hackberry">Teams</h2>
        {hasManualChanges && (
          <button onClick={onReset} className="btn-secondary">
            Reset to Auto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map(team => (
          <TeamCard
            key={team.index}
            team={team}
            allTeams={teams}
            avgTotal={avgTotal}
            onMove={onMove}
            onRename={onRename}
          />
        ))}
      </div>
    </div>
  )
}
