import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unread = searchParams.get('unread')

  let query = supabase
    .from('notifications')
    .select('id, message, is_read, created_at, booking_id, group_id, bookings(match_date, match_time, field_name), groups(name)')
    .eq('player_id', user.id)
    .order('created_at', { ascending: false })

  if (unread === 'true') {
    query = query.eq('is_read', false)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const formatted = data.map((n: any) => ({
    id: n.id,
    message: n.message,
    is_read: n.is_read,
    created_at: n.created_at,
    booking_id: n.booking_id,
    group_id: n.group_id,
    group_name: n.groups?.name,
    match_date: n.bookings?.match_date,
    match_time: n.bookings?.match_time,
    field_name: n.bookings?.field_name
  }))

  return NextResponse.json({ notifications: formatted })
}

export async function PATCH() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('player_id', user.id)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, updatedCount: data?.length || 0 })
}
