/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from '@/lib/supabase/server'
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
  const allowedUpdates = ['full_name', 'preferred_position', 'secondary_position', 'email', 'avatar_url', 'email_notifications', 'security_question', 'security_answer']
  const updates: any = {}

  for (const key of allowedUpdates) {
    if (body[key] !== undefined) {
      updates[key] = body[key]
    }
  }

  // Handle username specifically with validation
  if (body.username !== undefined) {
    const username = body.username.trim().toLowerCase()
    if (!username) {
      return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 })
    }
    if (username.includes(' ')) {
      return NextResponse.json({ error: 'Username cannot contain spaces' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
      return NextResponse.json({ error: 'Username can only contain letters, numbers, underscores, and periods' }, { status: 400 })
    }
    updates.username = username
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', params.playerId)
    .select()
    .single()

  if (error) {
    if (error.message.includes('profiles_username_key') || error.code === '23505') {
      return NextResponse.json({ error: 'This username is already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, profile: data })
}
