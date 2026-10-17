import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const lf = (x: string) => x.split('\r\n').join('\n')

describe('dark theme layer', () => {
  it('app/theme-dark.css is up to date (run `npm run theme:dark` after adding colour classes)', async () => {
    const { generate } = await import('../scripts/gen-theme-dark.mjs')
    const committed = readFileSync(path.join(__dirname, '..', 'app', 'theme-dark.css'), 'utf8')
    expect(lf(committed)).toBe(lf(await generate()))
  })

  it('maps surfaces, text and tints, and leaves share cards alone', () => {
    const css = readFileSync(path.join(__dirname, '..', 'app', 'theme-dark.css'), 'utf8')
    const nd = ':where(:not(.no-dark, .no-dark *))'
    expect(css).toContain(`:where(.dark) .bg-white${nd} { background-color: rgb(14 18 35 / 1); }`)
    expect(css).toContain(`:where(.dark) .text-neutral-900${nd} { color: rgb(248 250 252 / 1); }`)
    expect(css).toContain(`:where(.dark) .bg-green-50${nd} { background-color: rgb(34 197 94 / 0.1); }`)
    // Mirrored variants carry .dark so they beat their light Tailwind version; plain ones stay at class weight.
    expect(css).toMatch(/^\.dark \.hover\\:/m)
    expect(css).not.toContain('.bg-white\\/5')
  })
})
