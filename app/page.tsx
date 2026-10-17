/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { ArrowRight, CalendarCheck, Share2, Trophy, Users } from 'lucide-react'
import { BrandLogo, BrandMark } from '@/components/brand/BrandLogo'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { LiveScoreDemo } from '@/components/landing/LiveScoreDemo'
import { AuctionDemo, NightSwitch, RsvpDemo, StatsDemo, TeamsDemo } from '@/components/landing/Demos'
import { CardFan } from '@/components/landing/CardFan'
import { Reveal } from '@/components/landing/Reveal'
import { createAdminClient } from '@/lib/supabase/server'

// Real numbers from the app (no made-up stats); refreshed hourly, hidden if they can't be loaded.
export const revalidate = 3600

async function loadCounts() {
  try {
    const db = createAdminClient()
    const [matches, goals, players, groups] = await Promise.all([
      db.from('match_schedule').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      db.from('goal_events').select('id', { count: 'exact', head: true }),
      db.from('profiles').select('id', { count: 'exact', head: true }),
      db.from('groups').select('id', { count: 'exact', head: true }),
    ])
    const c = { matches: matches.count ?? 0, goals: goals.count ?? 0, players: players.count ?? 0, groups: groups.count ?? 0 }
    return c.matches > 0 ? c : null
  } catch {
    return null
  }
}

const TICKER = ['RSVPs & waitlists', 'Balanced teams', 'Player auctions', 'Live scores', 'One shared clock', 'Player of the match', 'Season stats', 'Share cards', 'Dark mode', 'Works on any phone']

function Section({ id, eyebrow, title, body, children, flip = false }: { id?: string; eyebrow: string; title: string; body: string; children: React.ReactNode; flip?: boolean }) {
  return (
    <section id={id} className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:gap-14 md:py-20">
      <Reveal className={flip ? 'md:order-2' : ''}>
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-app-primary">{eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] md:text-5xl">{title}</h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-app-muted">{body}</p>
      </Reveal>
      <Reveal delay={120} className={flip ? 'md:order-1' : ''}>
        <div className="rounded-[28px] border border-app-line bg-app-surface p-5 shadow-sm md:p-6">{children}</div>
      </Reveal>
    </section>
  )
}

export default async function LandingPage() {
  const counts = await loadCounts()

  return (
    <div className="min-h-dvh overflow-x-clip bg-app-bg text-app-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-app-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-app-line bg-app-bg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <Link href="/" aria-label="KhelaHbe home" className="mr-auto">
            <BrandLogo size={36} animate />
          </Link>
          <ThemeToggle />
          <Link href="/login" className="hidden h-11 items-center rounded-full px-4 text-sm font-bold text-app-muted hover:text-app-ink sm:flex">
            Sign in
          </Link>
          <Link href="/register" className="flex h-11 items-center gap-1.5 rounded-full bg-app-ink px-4 text-sm font-bold text-app-bg">
            Get started <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      <main id="main">
        {/* ── Hero ── */}
        <section className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_70%_20%,rgba(21,128,61,0.14),transparent)] dark:bg-[radial-gradient(60%_60%_at_70%_20%,rgba(74,222,128,0.12),transparent)]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 md:grid-cols-[1.1fr_1fr] md:pb-24 md:pt-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-app-accent px-3 py-1 text-sm font-bold text-app-on-accent">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-app-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-app-primary" />
                </span>
                Khela hobe!
              </span>
              <h1 className="mt-5 font-display text-[44px] font-extrabold leading-[0.98] sm:text-6xl md:text-7xl">
                Football night,
                <br />
                <span className="text-app-primary">sorted.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-app-muted md:text-xl">
                RSVPs, fair teams, a live player auction, live scores and season stats for your group, in one app the whole squad
                can use.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="flex h-14 items-center gap-2 rounded-2xl bg-app-primary px-6 text-lg font-bold text-app-on-primary shadow-lg shadow-green-700/20 transition-transform hover:-translate-y-0.5">
                  Start your group <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                <Link href="/login" className="flex h-14 items-center rounded-2xl border border-app-line bg-app-surface px-6 text-lg font-bold">
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-sm text-app-muted">Works on any phone. Add it to your home screen like an app.</p>
            </div>
            <Reveal delay={150}>
              <LiveScoreDemo />
            </Reveal>
          </div>
        </section>

        {/* ── Ticker ── */}
        <div className="border-y border-app-line bg-app-surface py-4" aria-label="Features">
          <div className="kh-marquee flex w-max gap-8 whitespace-nowrap font-display text-xl font-extrabold">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="flex items-center gap-8" aria-hidden={i >= TICKER.length}>
                {t}
                <BrandMark size={18} />
              </span>
            ))}
          </div>
        </div>

        {/* ── Features ── */}
        <Section
          eyebrow="Before the match"
          title="Who's in? Sorted."
          body="Players tap in or out from the matchday page. Spots fill, a waitlist forms, and the next in line gets in when someone drops out."
        >
          <RsvpDemo />
        </Section>

        <Section
          flip
          eyebrow="Teams"
          title="Fair teams in one tap"
          body="Teams are balanced on real results: wins, goals and assists from your group's past matches. Swap anyone before you save."
        >
          <TeamsDemo />
        </Section>

        <Section
          eyebrow="Draft night"
          title="Run a player auction"
          body="Captains bid from their own phones with a budget, players come up tier by tier, and you call each sale. Everyone else watches live."
        >
          <AuctionDemo />
        </Section>

        <Section
          flip
          eyebrow="After the match"
          title="Share cards worth posting"
          body="Results, player of the match, matchday tables and auction squads, made for WhatsApp and Stories in one tap."
        >
          <div className="flex flex-col items-center gap-3">
            <CardFan />
            <p className="flex items-center gap-1.5 text-sm text-app-muted">
              <Share2 className="h-4 w-4" aria-hidden /> Tap the cards
            </p>
          </div>
        </Section>

        <Section
          eyebrow="The season"
          title="A season that remembers"
          body="Every goal, assist, clean sheet and player of the match adds up into points per player, with your group's own scoring rules."
        >
          <StatsDemo />
        </Section>

        <Section flip eyebrow="9 pm kick-off" title="Easy on the eyes under floodlights" body="A dark mode made for late games. It follows your phone, or flip it yourself.">
          <NightSwitch />
        </Section>

        {/* ── How it works ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <Reveal>
            <h2 className="text-center font-display text-4xl font-extrabold md:text-5xl">Up and running before kick-off</h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: Users, t: 'Create your group', d: 'Name it, and you are the admin.' },
              { icon: CalendarCheck, t: 'Share the invite code', d: 'Players join from their phones in seconds.' },
              { icon: Trophy, t: 'Book a matchday and play', d: 'RSVPs, teams, scores and stats follow.' },
            ].map((s, i) => (
              <li key={s.t}>
                <Reveal delay={i * 100} className="h-full">
                  <div className="h-full rounded-[24px] border border-app-line bg-app-surface p-6">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-5xl font-extrabold text-app-primary">{i + 1}</span>
                      <s.icon className="h-7 w-7 text-app-muted" aria-hidden />
                    </div>
                    <h3 className="mt-4 text-xl font-extrabold">{s.t}</h3>
                    <p className="mt-1 text-app-muted">{s.d}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Real numbers ── */}
        {counts && (
          <section className="mx-auto max-w-6xl px-4 pb-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { v: counts.matches, l: 'matches played' },
                { v: counts.goals, l: 'goals logged' },
                { v: counts.players, l: 'players' },
                { v: counts.groups, l: 'groups' },
              ].map((s) => (
                <div key={s.l} className="rounded-[20px] border border-app-line bg-app-surface p-5">
                  <div className="font-display text-4xl font-extrabold tabular">{s.v.toLocaleString()}</div>
                  <div className="text-sm text-app-muted">{s.l} on KhelaHbe</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Final call ── */}
        <section className="px-4 py-14 md:py-20">
          <div className="no-dark relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#020617] px-6 py-14 text-center text-[#f8fafc] md:py-20">
            <div className="absolute inset-x-0 bottom-0 h-32 opacity-50 [background:repeating-linear-gradient(90deg,#052e16_0_44px,#064e3b_44px_88px)]" aria-hidden />
            <div className="absolute left-1/2 top-[-140px] h-[380px] w-[620px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(255,255,255,0.16),transparent)]" aria-hidden />
            <div className="relative">
              <BrandMark size={64} className="mx-auto" />
              <h2 className="mx-auto mt-6 max-w-2xl font-[family-name:var(--font-ka-barlow-condensed)] text-5xl font-extrabold uppercase leading-[0.95] md:text-7xl">
                Khela hobe? Bring your group.
              </h2>
              <Link href="/register" className="mt-8 inline-flex h-14 items-center gap-2 rounded-2xl bg-[#22c55e] px-7 text-lg font-bold text-[#052e16]">
                Create your group <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-app-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center">
          <div className="flex flex-col gap-2">
            <BrandLogo size={30} />
            <p className="text-sm text-app-muted">© {new Date().getFullYear()} KhelaHbe. Made for the game.</p>
          </div>
          <nav aria-label="Footer" className="flex gap-6 text-sm font-semibold md:ml-10">
            <Link href="/login" className="text-app-muted hover:text-app-ink">Sign in</Link>
            <Link href="/register" className="text-app-muted hover:text-app-ink">Create an account</Link>
          </nav>
          <a
            href="https://bigapeweb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 rounded-2xl border border-app-line bg-app-surface px-3 py-2 md:ml-auto"
          >
            <img src="/brand/bigapeweb-mark.svg" alt="" width={32} height={32} className="h-8 w-8 dark:hidden" />
            <img src="/brand/bigapeweb-mark-dark.svg" alt="" width={32} height={32} className="hidden h-8 w-8 dark:block" />
            <span className="text-sm leading-tight">
              <span className="block text-app-muted">Developed by</span>
              <span className="font-extrabold group-hover:text-app-primary">BigApeWeb</span>
            </span>
          </a>
        </div>
      </footer>
    </div>
  )
}
