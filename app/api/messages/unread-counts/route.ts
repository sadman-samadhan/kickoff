import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/groupAuth'
import { createAdminClient } from '@/lib/supabase/server'

// Unread chat counts for every group the user belongs to, in one request.
// Body: { groupReadTimestamps?: { [groupId]: epochMs } } — the client's "last read" times (localStorage).
// Groups never opened count only the last 30 days, not all history.
const NEVER_READ_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const readAt: Record<string, unknown> =
      body?.groupReadTimestamps && typeof body.groupReadTimestamps === 'object' ? body.groupReadTimestamps : {}

    const admin = createAdminClient()
    const { data: memberships } = await admin.from('group_members').select('group_id').eq('player_id', user.id)
    const floor = Date.now() - NEVER_READ_WINDOW_MS

    const counts: Record<string, number> = {}
    await Promise.all(
      (memberships || []).map(async ({ group_id: groupId }) => {
        const ts = typeof readAt[groupId] === 'number' && (readAt[groupId] as number) > floor ? (readAt[groupId] as number) : floor
        const { count, error } = await admin
          .from('group_messages')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', groupId)
          .neq('sender_id', user.id)
          .gt('created_at', new Date(ts).toISOString())
        if (!error) counts[groupId] = count ?? 0
      }),
    )

    return NextResponse.json(counts)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
