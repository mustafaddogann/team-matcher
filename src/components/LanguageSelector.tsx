import type { TeamNameLanguage } from '../types'

const LANGUAGE_OPTIONS: { value: TeamNameLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Turkce' },
  { value: 'ar', label: 'العربية' },
]

interface LanguageSelectorProps {
  value: TeamNameLanguage
  onChange: (lang: TeamNameLanguage) => void
}

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foggy mb-2">
        Team Names
      </label>
      <div className="flex rounded-full border border-hackberry/15 overflow-hidden bg-kazan p-0.5">
        {LANGUAGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3.5 py-1.5 text-sm font-medium transition-all rounded-full ${
              value === opt.value
                ? 'bg-white text-hackberry shadow-airbnb-border'
                : 'text-foggy hover:text-hackberry'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
