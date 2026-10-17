'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeChoice } from './ThemeProvider'

/** Header button: switches between light and dark (an explicit choice overrides the phone's setting). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolved, setChoice } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={`Switch to ${next} mode`}
      className={`w-10 h-10 rounded-full flex items-center justify-center text-app-muted hover:text-app-ink hover:bg-app-soft transition-colors ${className}`}
    >
      {/* Icon follows the class the head script already set, so dark users don't see a flash of the wrong one. */}
      <Sun className="w-5 h-5 hidden dark:block" aria-hidden />
      <Moon className="w-5 h-5 dark:hidden" aria-hidden />
    </button>
  )
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'Phone setting', Icon: Monitor },
]

/** Three-way picker for the profile page. */
export function ThemePicker() {
  const { choice, setChoice } = useTheme()
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          onClick={() => setChoice(value)}
          className={`min-h-16 rounded-2xl border flex flex-col items-center justify-center gap-1 text-sm font-semibold transition-colors ${
            choice === value ? 'border-app-primary bg-app-soft text-app-ink ring-1 ring-app-primary' : 'border-app-line bg-app-surface text-app-muted'
          }`}
        >
          <Icon className="w-5 h-5" />
          {label}
        </button>
      ))}
    </div>
  )
}
