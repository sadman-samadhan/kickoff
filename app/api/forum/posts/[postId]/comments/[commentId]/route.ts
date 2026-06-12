import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function DELETE(
  req: Request,
  { params }: { params: { postId: string; commentId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const SITE_ADMINS = ['sakib.samadhan@gmail.com', 'sadman.sakib0008@gmail.com']
  const isSiteAdmin = user.email && SITE_ADMINS.includes(user.email)

  let deleteQuery
  if (isSiteAdmin) {
    const adminClient = createAdminClient()
    deleteQuery = adminClient
      .from('forum_comments')
      .delete()
      .eq('id', params.commentId)
  } else {
    deleteQuery = supabase
      .from('forum_comments')
      .delete()
      .eq('id', params.commentId)
      .eq('author_id', user.id)
  }

  const { error } = await deleteQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
