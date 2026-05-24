import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request, { params }: { params: { postId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the post
  const { data: post, error: postError } = await supabase
    .from('forum_posts')
    .select('*, author:profiles!author_id(full_name, avatar_url)')
    .eq('id', params.postId)
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 404 })

  // Get comments
  const { data: comments, error: commentsError } = await supabase
    .from('forum_comments')
    .select('*, author:profiles!author_id(full_name, avatar_url)')
    .eq('post_id', params.postId)
    .order('created_at', { ascending: true })

  if (commentsError) return NextResponse.json({ error: commentsError.message }, { status: 500 })

  return NextResponse.json({ post, comments: comments || [] })
}

export async function DELETE(req: Request, { params }: { params: { postId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('forum_posts')
    .delete()
    .eq('id', params.postId)
    .eq('author_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
