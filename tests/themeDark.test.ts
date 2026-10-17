import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('dark theme layer', () => {
  it('app/theme-dark.css is up to date (run `npm run theme:dark` after adding colour classes)', async () => {
    const { generate } = await import('../scripts/gen-theme-dark.mjs')
    const committed = readFileSync(path.join(__dirname, '..', 'app', 'theme-dark.css'), 'utf8')
    expect(committed).toBe(await generate())
  })

  it('maps surfaces, text and tints, and leaves share cards alone', () => {
    const css = readFileSync(path.join(__dirname, '..', 'app', 'theme-dark.css'), 'utf8')
    expect(css).toContain(':where(.dark) .bg-white:not(.no-dark):not(.no-dark *) { background-color: rgb(14 18 35 / 1); }')
    expect(css).toContain(':where(.dark) .text-neutral-900:not(.no-dark):not(.no-dark *) { color: rgb(248 250 252 / 1); }')
    expect(css).toMatch(/\.bg-green-50:not\(\.no-dark\):not\(\.no-dark \*\) \{ background-color: rgb\(34 197 94 \/ 0\.1\); \}/)
    expect(css).not.toContain('.bg-white\/5:')
  })
})
