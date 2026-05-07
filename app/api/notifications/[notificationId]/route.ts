import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { notificationId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: notif } = await supabase
    .from('notifications')
    .select('player_id')
    .eq('id', params.notificationId)
    .single()

  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (notif.player_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', params.notificationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
