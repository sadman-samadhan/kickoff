import { ImageResponse } from 'next/og'
import { kit } from '@/components/live/kit'
import type { MatchdaySummary } from './matchdaySummary'
import { prettyDate } from './format'

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: 'normal' }
let fontsPromise: Promise<Font[]> | null = null

/** Barlow Condensed (the Floodlight display face) as TTF from Google Fonts; falls back to the default font. */
function loadFonts(): Promise<Font[]> {
  fontsPromise ??= (async () => {
    try {
      const css = await (await fetch('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;800&display=swap')).text()
      const urls = Array.from(css.matchAll(/font-weight: (\d+);[^}]*?src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/g))
      const fonts = await Promise.all(
        urls.map(async ([, w, url]) => ({ name: 'Barlow Condensed', data: await (await fetch(url)).arrayBuffer(), weight: (Number(w) >= 700 ? 800 : 400) as 400 | 800, style: 'normal' as const })),
      )
      return fonts
    } catch {
      fontsPromise = null
      return []
    }
  })()
  return fontsPromise
}

// 1200×630 link-preview image for a matchday (Floodlight look): results, champion and top scorer.
export async function matchdayImage(s: Pick<MatchdaySummary, 'group' | 'date' | 'time' | 'venue' | 'playersIn' | 'fixtures' | 'champion' | 'topScorer'>) {
  const fixtures = s.fixtures.slice(0, 5)
  const fonts = await loadFonts()
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: '#020617', color: '#f8fafc', padding: '56px 64px', position: 'relative', fontFamily: fonts.length ? 'Barlow Condensed' : 'sans-serif' }}>
        {/* Mown-grass stripes (Satori has no repeating gradients). */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, display: 'flex', opacity: 0.55 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={{ display: 'flex', width: 60, height: 170, background: i % 2 ? '#064e3b' : '#052e16' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: '#4ade80' }}>Matchday</div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: 3 }}>
            KHELA<span style={{ color: '#4ade80' }}>HOBE</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, marginTop: 14, lineHeight: 1 }}>{s.group}</div>
        <div style={{ display: 'flex', fontSize: 28, color: '#94a3b8', marginTop: 12 }}>{[prettyDate(s.date), s.time, s.venue].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
          {fixtures.length === 0 ? (
            <div style={{ display: 'flex', fontSize: 34, color: '#cbd5e1' }}>{`${s.playersIn} players in`}</div>
          ) : (
            fixtures.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 32, fontWeight: 700, marginBottom: 10 }}>
                <div style={{ display: 'flex', width: 22, height: 22, borderRadius: 11, background: kit(f.homeColor).base, marginRight: 14 }} />
                <div style={{ display: 'flex', width: 360 }}>{f.home}</div>
                <div style={{ display: 'flex', width: 130, justifyContent: 'center', color: f.hs === null ? '#64748b' : '#4ade80', fontWeight: 800 }}>{f.hs === null ? 'v' : `${f.hs}–${f.as}`}</div>
                <div style={{ display: 'flex', width: 22, height: 22, borderRadius: 11, background: kit(f.awayColor).base, marginRight: 14 }} />
                <div style={{ display: 'flex' }}>{f.away}</div>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', marginTop: 'auto' }}>
          {s.champion ? (
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, background: '#fbbf24', color: '#1c1003', borderRadius: 14, padding: '10px 20px', marginRight: 18 }}>{`🏆 ${s.champion}`}</div>
          ) : null}
          {s.topScorer ? (
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, background: '#0e1223', border: '2px solid #1e293b', borderRadius: 14, padding: '10px 20px' }}>
              {`⚽ ${s.topScorer.name} · ${s.topScorer.goals}`}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fonts.length ? fonts : undefined, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' } },
  )
}
