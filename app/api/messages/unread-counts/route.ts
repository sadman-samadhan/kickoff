import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { groupReadTimestamps } = await req.json()
    if (!groupReadTimestamps || typeof groupReadTimestamps !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const counts: Record<string, number> = {}

    // We do sequential or parallel count fetches. Since groups are usually < 10, Promise.all is fine.
    await Promise.all(
      Object.entries(groupReadTimestamps).map(async ([groupId, timestamp]) => {
        const query = supabase
          .from('group_messages')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId)
          .neq('sender_id', user.id)

        // Only count messages newer than the timestamp if provided
        if (timestamp && typeof timestamp === 'number') {
           const isoDate = new Date(timestamp).toISOString()
           query.gt('created_at', isoDate)
        }

        const { count, error } = await query
        if (!error && count !== null) {
          counts[groupId] = count
        }
      })
    )

    return NextResponse.json(counts)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
