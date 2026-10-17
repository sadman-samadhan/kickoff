import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { describeMatchday, loadMatchdaySummary, prettyDate } from '@/lib/share/matchdaySummary'
import { appUrl } from '@/lib/utils'

// Public preview of a matchday, shown to link-preview bots (see middleware) and to anyone opening /share/…:
// the same summary a share card shows, with a link into the app.
type Props = { params: { bookingId: string } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = UUID.test(params.bookingId) ? await loadMatchdaySummary(params.bookingId) : null
  if (!s) return { title: 'KhelaHobe', robots: { index: false } }
  const title = `${s.group} · ${prettyDate(s.date)}`
  const description = describeMatchday(s)
  const image = appUrl(`/api/og/matchday/${s.bookingId}`)
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630 }],
      siteName: 'KhelaHobe',
      type: 'website',
      url: appUrl(`/share/matchday/${s.bookingId}`),
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function SharedMatchday({ params }: Props) {
  const s = UUID.test(params.bookingId) ? await loadMatchdaySummary(params.bookingId) : null
  if (!s) notFound()
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-app-surface border border-app-line p-6 flex flex-col gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-app-primary">Matchday</div>
          <h1 className="font-display text-3xl font-extrabold mt-1">{s.group}</h1>
          <p className="text-sm text-app-muted mt-1">{[prettyDate(s.date), s.time, s.venue].filter(Boolean).join(' · ')}</p>
        </div>
        {s.fixtures.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {s.fixtures.map((f, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-app-soft px-3 py-2 text-sm font-semibold">
                <span className="text-right truncate">{f.home}</span>
                <span className="font-display font-extrabold tabular px-2">{f.hs === null ? 'v' : `${f.hs}–${f.as}`}</span>
                <span className="truncate">{f.away}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm">{describeMatchday(s)}</p>
        <Link href="/login" className="h-12 rounded-2xl bg-app-primary text-app-on-primary font-bold flex items-center justify-center">
          Sign in to KhelaHobe
        </Link>
      </div>
    </main>
  )
}
