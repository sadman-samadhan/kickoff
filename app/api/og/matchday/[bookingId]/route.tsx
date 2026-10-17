import { loadMatchdaySummary } from '@/lib/share/matchdaySummary'
import { matchdayImage } from '@/lib/share/matchdayImage'

export const runtime = 'edge'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: { bookingId: string } }) {
  const s = UUID.test(params.bookingId) ? await loadMatchdaySummary(params.bookingId) : null
  if (!s) return new Response('Not found', { status: 404 })
  return matchdayImage(s)
}
