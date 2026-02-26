import type { BalancerConfig } from '../types'
import LanguageSelector from './LanguageSelector'

interface TeamSettingsProps {
  config: BalancerConfig
  onUpdate: (updates: Partial<BalancerConfig>) => void
  onGenerate: () => void
  onShuffleNames: () => void
  canGenerate: boolean
  hasTeams: boolean
}

export default function TeamSettings({
  config,
  onUpdate,
  onGenerate,
  onShuffleNames,
  canGenerate,
  hasTeams,
}: TeamSettingsProps) {
  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold text-hackberry mb-5">Team Settings</h2>

      <div className="flex flex-wrap items-end gap-5">
        <div>
          <label className="block text-sm font-semibold text-foggy mb-2">
            Number of Teams
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdate({ teamCount: Math.max(2, config.teamCount - 1) })}
              disabled={config.teamCount <= 2}
              className="w-9 h-9 rounded-full border border-hackberry/20 text-hackberry font-bold hover:bg-kazan hover:border-hackberry/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              -
            </button>
            <span className="text-2xl font-bold text-hackberry font-mono w-8 text-center">
              {config.teamCount}
            </span>
            <button
              onClick={() => onUpdate({ teamCount: Math.min(10, config.teamCount + 1) })}
              disabled={config.teamCount >= 10}
              className="w-9 h-9 rounded-full border border-hackberry/20 text-hackberry font-bold hover:bg-kazan hover:border-hackberry/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>

        <LanguageSelector
          value={config.nameLanguage ?? 'en'}
          onChange={lang => onUpdate({ nameLanguage: lang })}
        />

        {hasTeams && (
          <button
            onClick={onShuffleNames}
            className="h-9 px-3 rounded-lg border border-hackberry/20 text-hackberry text-sm font-semibold hover:bg-kazan hover:border-hackberry/40 transition-all self-end"
          >
            Shuffle Names
          </button>
        )}

        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="btn-generate"
        >
          {hasTeams ? 'Re-Generate Teams' : 'Generate Teams'}
        </button>
      </div>

      {!canGenerate && (
        <p className="mt-3 text-sm text-arches font-medium">
          Need at least {config.teamCount} participants with names to generate teams.
        </p>
      )}
    </div>
  )
}
