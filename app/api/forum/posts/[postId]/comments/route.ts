import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: { postId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { content } = body

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('forum_comments')
    .insert({
      post_id: params.postId,
      author_id: user.id,
      content: content.trim()
    })
    .select('*, author:profiles!author_id(full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
