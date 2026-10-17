// Team kit colours → readable text, stripes and buttons for the Kit Colours scoring layout.

const NAMED: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', black: '#111827', white: '#ffffff',
  orange: '#f97316', purple: '#8b5cf6', pink: '#ec4899', grey: '#6b7280', gray: '#6b7280', navy: '#1e3a8a', sky: '#0ea5e9',
}

function toRgb(color: string | null | undefined, fallback: string): [number, number, number] {
  let c = (color || '').trim().toLowerCase()
  if (NAMED[c]) c = NAMED[c]
  c = c.replace(/^#/, '')
  if (/^[0-9a-f]{3}$/.test(c)) c = c.split('').map((x) => x + x).join('')
  if (!/^[0-9a-f]{6}$/.test(c)) return color === fallback ? [34, 197, 94] : toRgb(fallback, fallback)
  const n = parseInt(c, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

function luminance([r, g, b]: [number, number, number]) {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

export type Kit = {
  base: string
  stripe: string
  /** Text/score colour on the kit. */
  ink: string
  isLight: boolean
  /** Player name buttons. */
  chipBg: string
  chipInk: string
  /** "+1 goal" style outline buttons. */
  ghostBorder: string
  ghostBg: string
  stripes: (angle?: number) => string
}

export function kit(color: string | null | undefined, fallback = '#22c55e'): Kit {
  const rgb = toRgb(color, fallback)
  const L = luminance(rgb)
  const isLight = contrast(L, 1) < contrast(L, luminance([17, 17, 17]))
  const shade = isLight ? rgb.map((v) => v * 0.9) : rgb.map((v) => v * 0.85)
  const deep = rgb.map((v) => v * 0.35)
  const base = hex(rgb)
  const stripe = hex(shade)
  return {
    base,
    stripe,
    ink: isLight ? '#111111' : '#ffffff',
    isLight,
    chipBg: isLight ? '#111111' : '#ffffff',
    chipInk: isLight ? '#ffffff' : hex(deep),
    ghostBorder: isLight ? 'rgba(17,17,17,0.6)' : 'rgba(255,255,255,0.7)',
    ghostBg: isLight ? 'rgba(255,255,255,0.35)' : 'rgba(17,17,17,0.25)',
    stripes: (angle = 90) => `repeating-linear-gradient(${angle}deg, ${base} 0 22px, ${stripe} 22px 44px)`,
  }
}

export function initials(name: string) {
  const parts = (name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || '')).toUpperCase()
}

/** Short display name: last name for registered players ("Rafiul Islam" → "Islam") unless it's ambiguous. */
export function shortNames(names: { id: string; full_name: string }[]) {
  const last = (n: string) => {
    const p = n.trim().split(/\s+/)
    return p.length > 1 ? p[p.length - 1] : p[0]
  }
  const first = (n: string) => n.trim().split(/\s+/)[0]
  const counts = new Map<string, number>()
  for (const p of names) counts.set(last(p.full_name), (counts.get(last(p.full_name)) || 0) + 1)
  return new Map(names.map((p) => [p.id, (counts.get(last(p.full_name)) || 0) > 1 ? first(p.full_name) : last(p.full_name)]))
}
