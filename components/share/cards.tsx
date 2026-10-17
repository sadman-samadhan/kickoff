/* eslint-disable @next/next/no-img-element */
// Share cards, laid out at 432px wide (post 432×540, story 432×768) and exported at 2.5× → 1080px.
// Two looks from the design canvas: "kit" (Kit Colours: team-colour stripes, cream footer) and
// "floodlight" (navy, glow, condensed capitals). Everything is inline-styled so the app theme never
// changes an exported image.

import { kit } from '@/components/live/kit'
import { cardHeight, type CardFormat } from './useShareImage'

export type CardStyle = 'kit' | 'floodlight'
export type CardMeta = { group: string; label?: string; date?: string; venue?: string }
type TeamRef = { name: string; color?: string | null }

const F = {
  kitDisplay: 'var(--font-ka-archivo), system-ui, sans-serif',
  kitBody: 'var(--font-ka-figtree), system-ui, sans-serif',
  flDisplay: 'var(--font-ka-barlow-condensed), system-ui, sans-serif',
  flBody: 'var(--font-ka-barlow), system-ui, sans-serif',
}
const KIT = { ink: '#111111', paper: '#fbfaf6', muted: '#6b675e', line: '#e7e3d8' }
const FL = { bg: '#020617', surface: 'rgba(14,18,35,0.92)', line: '#1e293b', ink: '#f8fafc', muted: '#94a3b8', soft: '#cbd5e1', green: '#4ade80', gold: '#fbbf24' }

const metaLine = (m: CardMeta) => [m.group, m.label, m.date, m.venue].filter(Boolean).join(' · ')

/** Shared outer frame: size, background, fonts. */
function Frame({ style, format, children, background }: { style: CardStyle; format: CardFormat; children: React.ReactNode; background?: string }) {
  const fl = style === 'floodlight'
  return (
    <div
      style={{
        width: 432,
        height: cardHeight(format),
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: background ?? (fl ? FL.bg : KIT.paper),
        color: fl ? FL.ink : KIT.ink,
        fontFamily: fl ? F.flBody : F.kitBody,
      }}
    >
      {fl && (
        <>
          <div style={{ position: 'absolute', left: '50%', top: -140, width: 560, height: 440, transform: 'translateX(-50%)', background: 'radial-gradient(closest-side, rgba(255,255,255,0.13), rgba(255,255,255,0))', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: 'repeating-linear-gradient(90deg, #052e16 0 36px, #064e3b 36px 72px)', opacity: 0.5, pointerEvents: 'none' }} />
        </>
      )}
      {children}
    </div>
  )
}

function Brand({ style, size = 16 }: { style: CardStyle; size?: number }) {
  return style === 'floodlight' ? (
    <span style={{ fontFamily: F.flDisplay, fontWeight: 800, fontSize: size, letterSpacing: '0.08em' }}>
      KHELA<span style={{ color: FL.green }}>HOBE</span>
    </span>
  ) : (
    <span style={{ fontFamily: F.kitDisplay, fontWeight: 800, fontSize: size - 1, textTransform: 'uppercase' }}>KhelaHobe</span>
  )
}

/** Title block used by the list cards. */
function Heading({ style, kicker, title, meta }: { style: CardStyle; kicker: string; title: string; meta: CardMeta }) {
  const fl = style === 'floodlight'
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: fl ? FL.green : KIT.muted }}>{kicker}</div>
      <div style={{ fontFamily: fl ? F.flDisplay : F.kitDisplay, fontWeight: 800, fontSize: 34, lineHeight: 1, marginTop: 6, textTransform: fl ? 'uppercase' : 'none' }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 6, color: fl ? FL.muted : KIT.muted }}>{metaLine(meta)}</div>
    </div>
  )
}

function Footer({ style, left }: { style: CardStyle; left?: string }) {
  const fl = style === 'floodlight'
  return (
    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative', fontSize: 12, color: fl ? FL.muted : KIT.muted, paddingTop: 12 }}>
      <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{left}</span>
      <Brand style={style} />
    </div>
  )
}

const Dot = ({ color, size = 14 }: { color?: string | null; size?: number }) => {
  const k = kit(color)
  return <span style={{ width: size, height: size, borderRadius: 999, background: k.base, boxShadow: k.isLight ? 'inset 0 0 0 1.5px rgba(0,0,0,0.25)' : 'none', flexShrink: 0, display: 'inline-block' }} />
}

const initials = (name: string) => {
  const p = (name || '?').trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

// ── Result ──

export type ResultData = {
  meta: CardMeta
  home: TeamRef & { score: number; scorers: string[] }
  away: TeamRef & { score: number; scorers: string[] }
  potm?: { name: string; line?: string } | null
  /** Full time (default), half-time or still playing. */
  state?: 'ft' | 'ht' | 'live'
}

const STATE_LABEL = { ft: ['FT', 'Full time', 'FULL TIME'], ht: ['HT', 'Half-time', 'HALF-TIME'], live: ['LIVE', 'Live', 'LIVE'] } as const

export function ResultCard({ data, style, format }: { data: ResultData; style: CardStyle; format: CardFormat }) {
  const story = format === 'story'
  const [badge, sentence, caps] = STATE_LABEL[data.state ?? 'ft']
  if (style === 'kit') {
    const half = (t: ResultData['home'], right: boolean) => {
      const k = kit(t.color, right ? '#2563eb' : '#16a34a')
      return (
        <div style={{ background: k.stripes(right ? 135 : 90), color: k.ink, padding: '24px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: right ? 'right' : 'left', minWidth: 0 }}>
          <div style={{ fontFamily: F.kitDisplay, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', lineHeight: 1.05, overflowWrap: 'anywhere' }}>{t.name}</div>
          <div style={{ fontFamily: F.kitDisplay, fontWeight: 800, fontSize: story ? 190 : 150, lineHeight: 0.85 }}>{t.score}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>{t.scorers.slice(0, story ? 9 : 5).map((s, i) => <div key={i}>{s}</div>)}</div>
        </div>
      )
    }
    return (
      <Frame style={style} format={format} background="#111111">
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', color: '#fff' }}>
          {half(data.home, false)}
          {half(data.away, true)}
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, background: KIT.paper, color: KIT.ink }}>
          <span style={{ fontFamily: F.kitDisplay, fontWeight: 800, fontSize: 15, letterSpacing: '0.08em', background: KIT.ink, color: KIT.paper, borderRadius: 6, padding: '4px 8px' }}>{badge}</span>
          <span style={{ flex: 1, fontSize: 14 }}>{data.potm ? <><b>{data.potm.name}</b> player of the match</> : sentence}</span>
          <Brand style={style} />
        </div>
        <div style={{ padding: '8px 20px 12px', fontSize: 12, color: '#b5b2a8', background: '#111111' }}>{metaLine(data.meta)}</div>
      </Frame>
    )
  }
  const team = (t: ResultData['home']) => {
    const k = kit(t.color)
    return (
      <div style={{ width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 64, height: 64, borderRadius: 18, background: k.base, color: k.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.flDisplay, fontWeight: 800, fontSize: 26 }}>{initials(t.name)}</span>
        <span style={{ fontFamily: F.flDisplay, fontWeight: 700, fontSize: 20, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1 }}>{t.name}</span>
      </div>
    )
  }
  return (
    <Frame style={style} format={format}>
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: FL.muted }}>{[data.meta.group, data.meta.label].filter(Boolean).join(' · ')}</span>
          <span style={{ fontFamily: F.flDisplay, fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', color: '#052e16', background: FL.green, borderRadius: 6, padding: '3px 8px' }}>{caps}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: story ? 90 : 34 }}>
          {team(data.home)}
          <div style={{ fontFamily: F.flDisplay, fontWeight: 800, fontSize: story ? 112 : 96, lineHeight: 1 }}>
            {data.home.score}<span style={{ color: '#475569', padding: '0 6px' }}>–</span>{data.away.score}
          </div>
          {team(data.away)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 22, fontSize: 14, color: FL.soft }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{data.home.scorers.slice(0, story ? 10 : 5).map((s, i) => <span key={i}>{s}</span>)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right' }}>{data.away.scorers.slice(0, story ? 10 : 5).map((s, i) => <span key={i}>{s}</span>)}</div>
        </div>
        {data.potm && (
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: FL.surface, border: '1px solid #a16207', borderRadius: 16, padding: '12px 14px' }}>
            <span style={{ width: 44, height: 44, borderRadius: 999, background: '#f59e0b', color: '#1c1003', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{initials(data.potm.name)}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: FL.gold }}>Player of the match</div>
              <div style={{ fontFamily: F.flDisplay, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', lineHeight: 1 }}>{data.potm.name}{data.potm.line ? ` · ${data.potm.line}` : ''}</div>
            </div>
          </div>
        )}
        <Footer style={style} left={[data.meta.date, data.meta.venue].filter(Boolean).join(' · ')} />
      </div>
    </Frame>
  )
}

// ── Player of the match ──

export type MotmData = {
  meta: CardMeta
  player: { name: string; team?: string; color?: string | null; position?: string | null; avatarUrl?: string | null }
  stats: { label: string; value: number | string }[]
  resultLine?: string
}

export function MotmCard({ data, style, format, kicker = 'Player of the match' }: { data: MotmData; style: CardStyle; format: CardFormat; kicker?: string }) {
  const k = kit(data.player.color, '#7c3aed')
  const story = format === 'story'
  const avatar = (size: number, ring?: string) =>
    data.player.avatarUrl ? (
      <img src={data.player.avatarUrl} alt="" crossOrigin="anonymous" style={{ width: size, height: size, borderRadius: 999, objectFit: 'cover', border: ring }} />
    ) : (
      <span style={{ width: size, height: size, borderRadius: 999, background: k.base, color: k.ink, border: ring, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: style === 'floodlight' ? F.flDisplay : F.kitDisplay, fontWeight: 800, fontSize: size * 0.4 }}>{initials(data.player.name)}</span>
    )
  if (style === 'kit') {
    return (
      <Frame style={style} format={format} background={k.stripes(90)}>
        <div style={{ color: k.ink, padding: '24px 22px 0', position: 'relative' }}>
          <div style={{ fontFamily: F.kitDisplay, fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kicker}</div>
          <div style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>{[data.meta.group, data.meta.date].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ margin: '22px 22px 0', height: story ? 300 : 170, borderRadius: 18, background: k.ghostBg, border: `2px solid ${k.ghostBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatar(story ? 200 : 128, `4px solid ${k.ink === '#ffffff' ? 'rgba(255,255,255,0.8)' : 'rgba(17,17,17,0.6)'}`)}
        </div>
        <div style={{ padding: '16px 22px 0', color: k.ink }}>
          <div style={{ fontFamily: F.kitDisplay, fontWeight: 800, fontSize: data.player.name.length > 12 ? 44 : 60, textTransform: 'uppercase', lineHeight: 0.92, overflowWrap: 'anywhere' }}>{data.player.name}</div>
          <div style={{ fontSize: 14, marginTop: 6, fontWeight: 600 }}>{[data.player.team, data.player.position].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ marginTop: 'auto', background: KIT.paper, color: KIT.ink, padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {data.stats.slice(0, 4).map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: F.kitDisplay, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: KIT.muted }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderTop: `2px solid ${KIT.ink}`, paddingTop: 8 }}>
            <span>{data.resultLine}</span>
            <Brand style={style} size={14} />
          </div>
        </div>
      </Frame>
    )
  }
  return (
    <Frame style={style} format={format}>
      <div style={{ position: 'absolute', left: '50%', top: 40, width: 460, height: 460, transform: 'translateX(-50%)', background: `radial-gradient(closest-side, ${k.base}73, ${k.base}00)`, pointerEvents: 'none' }} />
      <div style={{ padding: '28px 24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: FL.gold }}>{kicker}</span>
        <span style={{ fontSize: 12, color: FL.muted, marginTop: 4 }}>{[data.meta.group, data.meta.date].filter(Boolean).join(' · ')}</span>
        <div style={{ marginTop: story ? 70 : 26 }}>{avatar(story ? 210 : 150, `4px solid ${FL.gold}`)}</div>
        <div style={{ fontFamily: F.flDisplay, fontWeight: 800, fontSize: data.player.name.length > 14 ? 42 : 54, textTransform: 'uppercase', lineHeight: 1, marginTop: 18, textAlign: 'center' }}>{data.player.name}</div>
        <div style={{ fontSize: 14, color: FL.soft, marginTop: 4 }}>{[data.player.team, data.player.position].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, data.stats.length) || 1}, 1fr)`, gap: 8, width: '100%', marginTop: 22 }}>
          {data.stats.slice(0, 3).map((s, i) => (
            <div key={s.label} style={{ background: FL.surface, border: `1px solid ${FL.line}`, borderRadius: 14, padding: '10px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: F.flDisplay, fontWeight: 800, fontSize: 32, lineHeight: 1, color: [FL.gold, '#38bdf8', FL.green][i] }}>{s.value}</div>
              <div style={{ fontSize: 11, color: FL.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
        {data.resultLine && <div style={{ marginTop: 14, fontSize: 13, color: FL.soft }}>{data.resultLine}</div>}
        <div style={{ marginTop: 'auto' }}><Brand style={style} size={18} /></div>
      </div>
    </Frame>
  )
}

// ── Team sheet ──

export type TeamSheetData = {
  meta: CardMeta
  team: TeamRef
  captain?: string | null
  players: { name: string; position?: string | null; isCaptain?: boolean; isGuest?: boolean }[]
}

export function TeamSheetCard({ data, style, format }: { data: TeamSheetData; style: CardStyle; format: CardFormat }) {
  const k = kit(data.team.color)
  const fl = style === 'floodlight'
  const rows = data.players
  // Rows shrink, then split into two columns, so a full squad always fits the card.
  const story = format === 'story'
  const twoCols = rows.length > (story ? 16 : 9)
  const compact = twoCols || rows.length > (story ? 11 : 6)
  return (
    <Frame style={style} format={format}>
      {!fl && <div style={{ height: story ? 150 : 104, background: k.stripes(90), color: k.ink, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>Team sheet</div>
        <div style={{ fontFamily: F.kitDisplay, fontWeight: 800, fontSize: 34, textTransform: 'uppercase', lineHeight: 1 }}>{data.team.name}</div>
      </div>}
      <div style={{ padding: fl ? 26 : '16px 22px 20px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', minHeight: 0 }}>
        {fl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: k.base, color: k.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.flDisplay, fontWeight: 800, fontSize: 22 }}>{initials(data.team.name)}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: FL.green }}>Team sheet</div>
              <div style={{ fontFamily: F.flDisplay, fontWeight: 800, fontSize: 32, textTransform: 'uppercase', lineHeight: 1 }}>{data.team.name}</div>
            </div>
          </div>
        ) : null}
        <div style={{ fontSize: 13, color: fl ? FL.muted : KIT.muted, marginTop: fl ? 10 : 0 }}>{metaLine(data.meta)}</div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: twoCols ? '1fr 1fr' : '1fr', gap: compact ? 4 : 7 }}>
          {rows.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: twoCols ? 6 : 10, padding: compact ? '4px 9px' : '8px 12px', borderRadius: 10, background: fl ? FL.surface : '#ffffff', border: `1px solid ${fl ? FL.line : KIT.line}`, fontSize: twoCols ? 12 : compact ? 14 : 16, fontWeight: 600, minWidth: 0 }}>
              <span style={{ width: twoCols ? 14 : 22, textAlign: 'right', fontWeight: 800, color: fl ? FL.muted : KIT.muted, fontSize: twoCols ? 10 : 12 }}>{i + 1}</span>
              <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</span>
              {p.isCaptain && <span style={{ fontSize: 11, fontWeight: 800, background: FL.gold, color: '#1c1003', borderRadius: 6, padding: '1px 6px' }}>C</span>}
              {p.position && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: fl ? FL.soft : KIT.muted }}>{p.position}</span>}
            </div>
          ))}
        </div>
        <Footer style={style} left={data.captain ? `Captain: ${data.captain}` : undefined} />
      </div>
    </Frame>
  )
}

// ── Fixtures ──

export type FixturesData = {
  meta: CardMeta
  fixtures: { home: TeamRef; away: TeamRef; score?: [number, number] | null; live?: boolean; stage?: string | null }[]
}

export function FixturesCard({ data, style, format }: { data: FixturesData; style: CardStyle; format: CardFormat }) {
  const fl = style === 'floodlight'
  const max = format === 'story' ? 14 : 8
  const list = data.fixtures.slice(0, max)
  const compact = list.length > (format === 'story' ? 10 : 6)
  const allDone = data.fixtures.length > 0 && data.fixtures.every((f) => f.score && !f.live)
  return (
    <Frame style={style} format={format}>
      <div style={{ padding: 26, display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <Heading style={style} kicker={allDone ? 'Results' : 'Fixtures & scores'} title={data.meta.group} meta={{ ...data.meta, group: '' }} />
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: compact ? 5 : 8 }}>
          {list.map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, padding: compact ? '7px 12px' : '11px 14px', borderRadius: 14, background: fl ? FL.surface : '#ffffff', border: `1px solid ${fl ? FL.line : KIT.line}`, fontSize: compact ? 14 : 15, fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.home.name}</span>
                <Dot color={f.home.color} />
              </span>
              <span style={{ minWidth: 62, textAlign: 'center', fontFamily: fl ? F.flDisplay : F.kitDisplay, fontWeight: 800, fontSize: compact ? 18 : 22, color: f.score ? (fl ? FL.green : KIT.ink) : fl ? FL.muted : KIT.muted, background: fl ? 'transparent' : f.score ? '#eef2ec' : 'transparent', borderRadius: 8, padding: '0 6px' }}>
                {f.score ? `${f.score[0]}–${f.score[1]}` : 'v'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Dot color={f.away.color} />
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.away.name}</span>
              </span>
            </div>
          ))}
          {data.fixtures.length > max && <div style={{ fontSize: 12, textAlign: 'center', color: fl ? FL.muted : KIT.muted }}>+{data.fixtures.length - max} more</div>}
        </div>
        <Footer style={style} />
      </div>
    </Frame>
  )
}

// ── Matchday table / champions ──

export type StandingsData = {
  meta: CardMeta
  rows: (TeamRef & { p: number; w: number; d: number; l: number; gd: number; pts: number })[]
  topScorer?: string | null
  /** Banner on top: decided champions, or the current leader mid-matchday. None before any result. */
  headline?: (TeamRef & { label: string; line?: string }) | null
}

export function StandingsCard({ data, style, format }: { data: StandingsData; style: CardStyle; format: CardFormat }) {
  const fl = style === 'floodlight'
  const champ = data.headline
  const k = kit(champ?.color)
  const story = format === 'story'
  return (
    <Frame style={style} format={format}>
      {champ && (
        <div style={{ background: fl ? `linear-gradient(135deg, ${k.base}, ${k.stripe})` : k.stripes(90), color: k.ink, padding: story ? '40px 26px 26px' : '22px 26px 18px', position: 'relative' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.9 }}>🏆 {champ.label}</div>
          <div style={{ fontFamily: fl ? F.flDisplay : F.kitDisplay, fontWeight: 800, fontSize: story ? 52 : 40, textTransform: 'uppercase', lineHeight: 1, marginTop: 6 }}>{champ.name}</div>
          {champ.line && <div style={{ fontSize: 13, marginTop: 6, fontWeight: 600 }}>{champ.line}</div>}
        </div>
      )}
      <div style={{ padding: '18px 26px 22px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <div style={{ fontSize: 13, color: fl ? FL.muted : KIT.muted }}>{metaLine(data.meta)}</div>
        <div style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', border: `1px solid ${fl ? FL.line : KIT.line}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 30px 30px 30px 40px 40px', gap: 4, padding: '8px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: fl ? FL.muted : KIT.muted, background: fl ? FL.surface : '#f1efe8' }}>
            <span>#</span><span>TEAM</span><span>W</span><span>D</span><span>L</span><span>GD</span><span style={{ textAlign: 'right' }}>PTS</span>
          </div>
          {data.rows.slice(0, story ? 12 : 6).map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 30px 30px 30px 40px 40px', gap: 4, alignItems: 'center', padding: '9px 12px', fontSize: 15, fontWeight: 600, borderTop: `1px solid ${fl ? FL.line : KIT.line}`, background: fl ? 'rgba(14,18,35,0.6)' : '#ffffff' }}>
              <span style={{ fontWeight: 800, color: fl ? FL.muted : KIT.muted }}>{i + 1}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><Dot color={r.color} size={12} /><span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.name}</span></span>
              <span>{r.w}</span><span>{r.d}</span><span>{r.l}</span><span>{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
              <span style={{ textAlign: 'right', fontFamily: fl ? F.flDisplay : F.kitDisplay, fontWeight: 800, fontSize: 18 }}>{r.pts}</span>
            </div>
          ))}
        </div>
        {data.topScorer && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 14, padding: '10px 14px', background: fl ? FL.surface : '#d9f99d', border: fl ? '1px solid #a16207' : 'none', fontSize: 14 }}>
            <span style={{ fontSize: 18 }}>⚽</span>
            <span><b style={{ color: fl ? FL.gold : '#3f6212' }}>Top scorer</b> · {data.topScorer}</span>
          </div>
        )}
        <Footer style={style} />
      </div>
    </Frame>
  )
}

// ── Top players / season stats ──

export type TopPlayersData = {
  meta: CardMeta
  title: string
  players: { name: string; team?: string | null; color?: string | null; position?: string | null; points: number; goals?: number; assists?: number; cleanSheets?: number }[]
}

export function TopPlayersCard({ data, style, format }: { data: TopPlayersData; style: CardStyle; format: CardFormat }) {
  const fl = style === 'floodlight'
  const story = format === 'story'
  const list = data.players.slice(0, story ? 10 : 6)
  const medal = ['#f59e0b', '#94a3b8', '#c2410c']
  return (
    <Frame style={style} format={format}>
      <div style={{ padding: 26, display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <Heading style={style} kicker={data.title} title={data.meta.group} meta={{ ...data.meta, group: '' }} />
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {list.map((p, i) => {
            const k = kit(p.color)
            const line = [p.goals ? `${p.goals}G` : null, p.assists ? `${p.assists}A` : null, p.cleanSheets ? `${p.cleanSheets}CS` : null].filter(Boolean).join(' · ')
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: i < 3 ? '11px 14px' : '8px 14px', borderRadius: 14, background: fl ? FL.surface : '#ffffff', border: `1px solid ${i < 3 ? medal[i] : fl ? FL.line : KIT.line}` }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, background: i < 3 ? medal[i] : fl ? '#1e293b' : '#eef2ec', color: i < 3 ? '#fff' : fl ? FL.soft : KIT.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: k.base }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: i < 3 ? 17 : 15, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: fl ? FL.muted : KIT.muted }}>{[p.position, p.team, line].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: fl ? F.flDisplay : F.kitDisplay, fontWeight: 800, fontSize: i < 3 ? 26 : 20, lineHeight: 1, color: fl ? FL.green : KIT.ink }}>{p.points}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: fl ? FL.muted : KIT.muted }}>PTS</div>
                </div>
              </div>
            )
          })}
        </div>
        <Footer style={style} />
      </div>
    </Frame>
  )
}

// ── One player's stats (profile) ──

export type PlayerStatsData = {
  name: string
  position?: string | null
  avatarUrl?: string | null
  subtitle: string
  stats: { label: string; value: number | string }[]
}

export function PlayerStatsCard({ data, style, format }: { data: PlayerStatsData; style: CardStyle; format: CardFormat }) {
  return (
    <MotmCard
      style={style}
      format={format}
      data={{
        meta: { group: data.subtitle },
        player: { name: data.name, position: data.position, avatarUrl: data.avatarUrl, color: style === 'kit' ? '#15803d' : '#22c55e' },
        stats: data.stats,
      }}
      kicker="Player stats"
    />
  )
}

// ── Final squads (auction) ──

export type SquadsData = {
  meta: CardMeta
  teams: (TeamRef & { players: string[]; captain?: string | null; spent?: number | null })[]
}

export function SquadsCard({ data, style, format }: { data: SquadsData; style: CardStyle; format: CardFormat }) {
  const fl = style === 'floodlight'
  const cols = data.teams.length > 2 ? 2 : data.teams.length || 1
  return (
    <Frame style={style} format={format}>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', minHeight: 0 }}>
        <Heading style={style} kicker="Final squads" title={data.meta.group} meta={{ ...data.meta, group: '' }} />
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, flex: 1, minHeight: 0 }}>
          {data.teams.map((t, i) => {
            const k = kit(t.color)
            return (
              <div key={i} style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${fl ? FL.line : KIT.line}`, background: fl ? FL.surface : '#ffffff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ background: k.stripes(90), color: k.ink, padding: '7px 10px', fontFamily: fl ? F.flDisplay : F.kitDisplay, fontWeight: 800, fontSize: 15, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t.name}</span>
                  {t.spent != null && <span style={{ opacity: 0.85 }}>{t.spent.toLocaleString()}</span>}
                </div>
                <div style={{ padding: '6px 10px', fontSize: 12, lineHeight: 1.45, fontWeight: 600 }}>
                  {t.captain && <div>{t.captain} <span style={{ fontSize: 10, fontWeight: 800, color: fl ? FL.gold : '#a16207' }}>C</span></div>}
                  {t.players.map((p, j) => <div key={j} style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p}</div>)}
                </div>
              </div>
            )
          })}
        </div>
        <Footer style={style} />
      </div>
    </Frame>
  )
}
