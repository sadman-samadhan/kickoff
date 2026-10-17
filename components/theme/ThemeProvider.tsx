'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { THEME_KEY } from './themeScript'

export type ThemeChoice = 'light' | 'dark' | 'system'
type Ctx = { choice: ThemeChoice; resolved: 'light' | 'dark'; setChoice: (c: ThemeChoice) => void }

const ThemeContext = createContext<Ctx>({ choice: 'system', resolved: 'light', setChoice: () => {} })

const systemDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && systemDark())
  const el = document.documentElement
  el.classList.toggle('dark', dark)
  el.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#020617' : '#f4f6f1'))
  return dark ? 'dark' : 'light'
}

/** Light (Clean Pitch) / dark (Floodlight) / follow the phone. Stored on this device only. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    let saved: ThemeChoice = 'system'
    try {
      const v = localStorage.getItem(THEME_KEY)
      if (v === 'light' || v === 'dark') saved = v
    } catch {
      // private mode
    }
    setChoiceState(saved)
    setResolved(apply(saved))
  }, [])

  useEffect(() => {
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolved(apply('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  const setChoice = useCallback((c: ThemeChoice) => {
    try {
      if (c === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, c)
    } catch {
      // private mode: still switch for this visit
    }
    setChoiceState(c)
    setResolved(apply(c))
  }, [])

  return <ThemeContext.Provider value={{ choice, resolved, setChoice }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
