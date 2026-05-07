import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { playerId: string } }) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== params.playerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', params.playerId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ profile })
}

export async function PATCH(req: Request, { params }: { params: { playerId: string } }) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== params.playerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const allowedUpdates = ['full_name', 'preferred_position', 'secondary_position', 'email', 'avatar_url', 'email_notifications']
  const updates: any = {}

  for (const key of allowedUpdates) {
    if (body[key] !== undefined) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', params.playerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, profile: data })
}
