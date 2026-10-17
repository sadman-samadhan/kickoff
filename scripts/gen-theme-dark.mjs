// Generates app/theme-dark.css: the Floodlight (dark) versions of the light-theme colour classes the app uses.
//
// Most screens were written with plain Tailwind classes (bg-white, text-neutral-900, bg-green-50 …). Instead of
// adding dark: variants to thousands of class names, this scans the source for the colour classes actually in use
// and emits a dark override for each one (white / neutral surfaces → Floodlight navy, dark text → light text,
// pale tints → translucent tints). Already-dark pieces (bg-neutral-900 cards with white text) stay dark.
// Anything inside an element with class "no-dark" (share cards, kit-coloured blocks) is left alone.
//
// Run `npm run theme:dark` after adding new colour classes; tests/themeDark.test.ts fails if this file is stale.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'app', 'theme-dark.css')

const GREYS = ['neutral', 'gray', 'slate', 'zinc', 'stone']
const TINTS = ['green', 'emerald', 'lime', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'red', 'orange', 'amber', 'yellow']

// Floodlight greys (r g b)
const SURFACE = '14 18 35'
const BG_GREY = { white: SURFACE, 50: '11 16 32', 100: '30 41 59', 200: '39 52 73', 300: '51 65 85', 400: '71 85 105', 500: '100 116 139', 600: '71 85 105', 700: '51 65 85', 800: '39 52 73', 900: '30 41 59', 950: SURFACE }
// Light text shades (50–300) are used on dark cards, which stay dark, so they are not touched.
const TEXT_GREY = { black: '248 250 252', 950: '248 250 252', 900: '248 250 252', 800: '248 250 252', 700: '226 232 240', 600: '203 213 225', 500: '148 163 184', 400: '100 116 139' }
const LINE_GREY = { white: SURFACE, 50: '30 41 59', 100: '30 41 59', 200: '30 41 59', 300: '51 65 85', 400: '71 85 105', 500: '100 116 139', 600: '100 116 139', 700: '51 65 85', 800: '30 41 59', 900: '30 41 59' }
const RING_GREY = { 900: '248 250 252', 800: '226 232 240', 200: '51 65 85', 100: '30 41 59' }

const STATES = { hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible', active: ':active', disabled: ':disabled', 'focus-within': ':focus-within' }
const SCREENS = { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' }

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(f)) out.push(p)
  }
  return out
}

const hex2rgb = (h) => {
  const n = parseInt(h.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** CSS declarations for one utility (no variants), or null if we don't override it. */
function declsFor(utility, palette) {
  const m = /^(bg|text|border|divide|ring|placeholder|from|to|shadow)-(white|black|[a-z]+)(?:-(\d{2,3}))?(?:\/(\d{1,3}))?$/.exec(utility)
  if (!m) return null
  const [, kind, family, shadeStr, alphaStr] = m
  const shade = shadeStr ? Number(shadeStr) : family
  const mult = alphaStr ? Number(alphaStr) / 100 : 1
  const isGrey = GREYS.includes(family) || family === 'white' || family === 'black'
  if (!isGrey && !TINTS.includes(family)) return null
  if ((family === 'white' || family === 'black') && shadeStr) return null

  let rgb = null
  let alpha = 1
  if (isGrey) {
    // Faint white/black (glass on dark cards, overlays) already works on dark; mostly-opaque white
    // (bg-white/95 headers and bars) is a surface and becomes Floodlight navy.
    if (family === 'black' && alphaStr && kind !== 'text') return null
    if (family === 'white' && alphaStr && kind !== 'text' && (kind !== 'bg' || mult < 0.5)) return null
    const table = kind === 'bg' ? BG_GREY : kind === 'text' || kind === 'placeholder' ? TEXT_GREY : kind === 'ring' ? RING_GREY : kind === 'shadow' ? null : LINE_GREY
    if (kind === 'shadow') return `--tw-shadow-color: rgb(0 0 0 / ${(0.35 * mult).toFixed(3)}); --tw-shadow: var(--tw-shadow-colored);`
    if (kind === 'from' || kind === 'to') {
      if (!['white', 50, 100].includes(shade)) return null
      rgb = shade === 100 ? BG_GREY[100] : SURFACE
    } else {
      rgb = table?.[shade]
    }
    if (!rgb) return null
    alpha = mult
  } else {
    const c = palette[family]
    const c500 = hex2rgb(c[500])
    if (kind === 'bg') {
      const a = { 50: 0.1, 100: 0.16, 200: 0.24 }[shade]
      if (!a) return null
      ;[rgb, alpha] = [c500, a * mult]
    } else if (kind === 'text' || kind === 'placeholder') {
      const to = { 600: 400, 700: 300, 800: 300, 900: 300, 950: 200 }[shade]
      if (!to) return null
      ;[rgb, alpha] = [hex2rgb(c[to]), mult]
    } else if (kind === 'border' || kind === 'divide' || kind === 'ring') {
      const a = { 50: 0.2, 100: 0.25, 200: 0.32, 300: 0.45 }[shade]
      if (!a) return null
      ;[rgb, alpha] = [c500, a * mult]
    } else if (kind === 'from' || kind === 'to') {
      const a = { 50: 0.12, 100: 0.18 }[shade]
      if (!a) return null
      ;[rgb, alpha] = [c500, a * mult]
    } else {
      return null
    }
  }

  const color = `rgb(${rgb} / ${Number(alpha.toFixed(3))})`
  switch (kind) {
    case 'bg': return `background-color: ${color};`
    case 'text': return `color: ${color};`
    case 'placeholder': return `color: ${color};`
    case 'border': return `border-color: ${color};`
    case 'divide': return `border-color: ${color};`
    case 'ring': return `--tw-ring-color: ${color};`
    case 'from': return `--tw-gradient-from: ${color} var(--tw-gradient-from-position); --tw-gradient-to: rgb(${rgb} / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);`
    case 'to': return `--tw-gradient-to: ${color} var(--tw-gradient-to-position);`
  }
  return null
}

const esc = (s) => s.replace(/([^a-zA-Z0-9_-])/g, '\\$1')

/** Full rule for a class (with variants), or null. */
function ruleFor(cls, palette) {
  const parts = cls.split(':')
  const utility = parts.pop()
  let media = null
  let pseudo = ''
  let ancestor = ''
  let placeholder = utility.startsWith('placeholder-')
  for (const p of parts) {
    if (SCREENS[p]) media = SCREENS[p]
    else if (STATES[p]) pseudo += STATES[p]
    else if (p === 'group-hover') ancestor = '.group:hover '
    else if (p === 'placeholder') placeholder = true
    else return null
  }
  const u = placeholder && !utility.startsWith('placeholder-') ? utility.replace(/^text-/, 'placeholder-') : utility
  const decls = declsFor(u, palette)
  if (!decls) return null
  // Specificity: a plain class (0,1,0) overrides the plain Tailwind class by coming later in the CSS, and loses
  // to every Tailwind variant (hover:, focus:, dark:, md: …) so those keep working. A mirrored variant
  // (hover:bg-white) carries an extra .dark so it beats its light Tailwind version. The no-dark escape hatch
  // sits inside :where() so it adds no weight.
  const variant = parts.length > 0
  const scope = variant ? '.dark ' : ':where(.dark) '
  const notNoDark = ':where(:not(.no-dark, .no-dark *))'
  const kind = u.split('-')[0]
  const sel =
    kind === 'divide'
      ? `${scope}${ancestor}.${esc(cls)}${notNoDark} > :not([hidden]) ~ :not([hidden])`
      : `${scope}${ancestor}.${esc(cls)}${pseudo}${notNoDark}${placeholder ? '::placeholder' : ''}`
  const rule = `${sel} { ${decls} }`
  return { rule, media }
}

export async function generate() {
  const palette = (await import(pathToFileURL(path.join(ROOT, 'node_modules', 'tailwindcss', 'colors.js')).href)).default
  const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
  const classes = new Set()
  const re = /(?<![\w-])((?:[a-z-]+:)*(?:bg|text|border|divide|ring|placeholder|from|to|shadow)-(?:white|black|[a-z]+)(?:-\d{2,3})?(?:\/\d{1,3})?)(?![\w/-])/g
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(re)) classes.add(m[1])
  }
  const plain = []
  const byMedia = {}
  for (const cls of Array.from(classes).sort()) {
    const r = ruleFor(cls, palette)
    if (!r) continue
    if (r.media) (byMedia[r.media] ||= []).push(r.rule)
    else plain.push(r.rule)
  }
  let css = '/* GENERATED by scripts/gen-theme-dark.mjs: do not edit. Floodlight (dark) overrides for light-theme colour classes. */\n'
  css += plain.join('\n') + '\n'
  for (const [w, rules] of Object.entries(byMedia).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    css += `@media (min-width: ${w}) {\n${rules.map((r) => '  ' + r).join('\n')}\n}\n`
  }
  return css
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const css = await generate()
  writeFileSync(OUT, css)
  console.log(`wrote ${path.relative(ROOT, OUT)} (${css.split('\n').length} lines)`)
}
