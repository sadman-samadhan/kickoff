import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request, { params }: { params: { groupId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const before = searchParams.get('before') // cursor-based pagination

  let query = supabase
    .from('group_messages')
    .select('*, sender:profiles!sender_id(full_name, avatar_url)')
    .eq('group_id', params.groupId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data?.reverse() || [])
}

export async function POST(req: Request, { params }: { params: { groupId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { content } = body

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      group_id: params.groupId,
      sender_id: user.id,
      content: content.trim()
    })
    .select('*, sender:profiles!sender_id(full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
