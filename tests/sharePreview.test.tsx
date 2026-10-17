import { describe, expect, it } from 'vitest'
import { isLinkPreviewBot, matchdayIdFromPath } from '@/lib/share/linkPreview'
import { describeMatchday } from '@/lib/share/format'
import { matchdayImage } from '@/lib/share/matchdayImage'

const G = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('link previews', () => {
  it('recognises chat-app link fetchers, not normal browsers', () => {
    expect(isLinkPreviewBot('WhatsApp/2.23.20.0 A')).toBe(true)
    expect(isLinkPreviewBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true)
    expect(isLinkPreviewBot('TelegramBot (like TwitterBot)')).toBe(true)
    expect(isLinkPreviewBot('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36')).toBe(false)
    expect(isLinkPreviewBot(null)).toBe(false)
    // In-app browsers are people: they must reach the login page.
    expect(isLinkPreviewBot('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Line/13.21.0')).toBe(false)
  })

  it('only matches matchday and scoring URLs', () => {
    expect(matchdayIdFromPath(`/groups/${G}/match/${B}`)).toBe(B)
    expect(matchdayIdFromPath(`/groups/${G}/match/${B}/game/${G}`)).toBe(B)
    expect(matchdayIdFromPath(`/groups/${G}/match/${B}/auction`)).toBeNull()
    expect(matchdayIdFromPath(`/groups/${G}`)).toBeNull()
    expect(matchdayIdFromPath(`/groups/${G}/match/not-a-uuid`)).toBeNull()
  })

  const summary = {
    group: 'KF Futsal',
    date: '2026-10-17',
    time: '20:00',
    venue: 'Khulna Turf',
    playersIn: 36,
    fixtures: [
      { home: 'Syndicate', homeColor: '#7c3aed', away: 'The Mob', awayColor: '#dc2626', hs: 3, as: 2, status: 'completed', stage: null },
      { home: 'Royals', homeColor: 'white', away: 'Titans', awayColor: '#0ea5e9', hs: null, as: null, status: 'scheduled', stage: null },
    ],
    champion: null as string | null,
    topScorer: { name: 'Labib Hasan', goals: 3 },
  }

  it('describes the matchday in one line', () => {
    expect(describeMatchday(summary)).toBe('Syndicate 3–2 The Mob')
    expect(describeMatchday({ ...summary, champion: 'Syndicate' })).toBe('🏆 Syndicate won the matchday · ⚽ Labib Hasan (3)')
    expect(describeMatchday({ ...summary, fixtures: [] })).toBe('36 players in · kick-off 20:00 · Khulna Turf')
  })

  // @vercel/og resolves its font/wasm files with path.join on import.meta.url, which breaks on Windows outside
  // Next's bundler; this runs on Linux CI/Vercel (and the route was checked through `next dev` locally).
  it.skipIf(process.platform === 'win32')('renders the 1200×630 preview image', async () => {
    const res = await matchdayImage({ ...summary, champion: 'Syndicate' })
    const png = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(png.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]) // "PNG"
    const view = new DataView(png.buffer)
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630])
  }, 30000)
})
