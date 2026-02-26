import type { Team } from '../types'
import { calculateOverallMetrics } from '../utils/metrics'

interface SummaryPanelProps {
  teams: Team[]
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 40
  const stroke = 5
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 90
      ? '#00A699'
      : score >= 70
        ? '#FC642D'
        : '#FF385C'

  return (
    <div className="score-gauge">
      <svg height={radius * 2} width={radius * 2}>
        <circle
          stroke="#EBEBEB"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold font-mono" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

export default function SummaryPanel({ teams }: SummaryPanelProps) {
  if (teams.length === 0) return null

  const metrics = calculateOverallMetrics(teams)

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold text-hackberry mb-5">Balance Summary</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-kazan rounded-2xl p-4 flex flex-col items-center justify-center">
          <ScoreGauge score={metrics.balanceScore} />
          <div className="text-xs text-foggy mt-2 font-medium">Balance Score</div>
        </div>

        <div className="bg-kazan rounded-2xl p-4 text-center flex flex-col justify-center">
          <div className="text-3xl font-bold text-hackberry font-mono">{metrics.spread}</div>
          <div className="text-xs text-foggy mt-1 font-medium">Spread</div>
        </div>

        <div className="bg-kazan rounded-2xl p-4 text-center flex flex-col justify-center">
          <div className="text-3xl font-bold text-hackberry font-mono">{metrics.stdDev.toFixed(1)}</div>
          <div className="text-xs text-foggy mt-1 font-medium">Std Dev</div>
        </div>

        <div className="bg-kazan rounded-2xl p-4 text-center flex flex-col justify-center">
          <div className="text-3xl font-bold text-hackberry font-mono">{metrics.totalParticipants}</div>
          <div className="text-xs text-foggy mt-1 font-medium">Players</div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06]">
              <th className="text-left py-2.5 font-semibold text-foggy text-xs uppercase tracking-wide">Team</th>
              <th className="text-right py-2.5 font-semibold text-foggy text-xs uppercase tracking-wide">Size</th>
              <th className="text-right py-2.5 font-semibold text-foggy text-xs uppercase tracking-wide">Total</th>
              <th className="text-right py-2.5 font-semibold text-foggy text-xs uppercase tracking-wide">Avg</th>
              <th className="text-right py-2.5 font-semibold text-foggy text-xs uppercase tracking-wide">Diff</th>
            </tr>
          </thead>
          <tbody>
            {metrics.teamMetrics.map(tm => (
              <tr key={tm.teamIndex} className="border-t border-black/[0.04]">
                <td className="py-2 font-semibold text-hackberry">{tm.teamName}</td>
                <td className="py-2 text-right text-hof font-mono">{tm.size}</td>
                <td className="py-2 text-right font-bold text-hackberry font-mono">{tm.total}</td>
                <td className="py-2 text-right text-hof font-mono">{tm.average.toFixed(1)}</td>
                <td
                  className={`py-2 text-right font-mono font-semibold ${
                    tm.diffFromAvg > 0
                      ? 'text-arches'
                      : tm.diffFromAvg < 0
                        ? 'text-babu'
                        : 'text-foggy'
                  }`}
                >
                  {tm.diffFromAvg > 0 ? '+' : ''}{tm.diffFromAvg.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
