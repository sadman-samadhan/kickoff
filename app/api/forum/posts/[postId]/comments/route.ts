/* eslint-disable @typescript-eslint/no-explicit-any */
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger push notifications in background
  ;(async () => {
    try {
      const { createAdminClient } = await import('@/lib/supabase/server')
      const supabaseAdmin = createAdminClient()

      const { data: post } = await supabaseAdmin
        .from('forum_posts')
        .select('author_id, title')
        .eq('id', params.postId)
        .single()

      if (!post) return

      const { data: siblingComments } = await supabaseAdmin
        .from('forum_comments')
        .select('author_id')
        .eq('post_id', params.postId)
        .neq('author_id', user.id)

      const recipientIds = new Set<string>()
      if (post.author_id && post.author_id !== user.id) {
        recipientIds.add(post.author_id)
      }
      siblingComments?.forEach(c => {
        if (c.author_id) recipientIds.add(c.author_id)
      })

      const recipientArray = Array.from(recipientIds)
      if (recipientArray.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, push_forum_enabled')
          .in('id', recipientArray)

        const pushRecipients = profiles?.filter(p => p.push_forum_enabled !== false).map(p => p.id) || []

        if (pushRecipients.length > 0) {
          const { data: subs } = await supabaseAdmin
            .from('push_subscriptions')
            .select('id, subscription_json')
            .in('user_id', pushRecipients)

          if (subs && subs.length > 0) {
            const commenterName = data.author?.full_name || 'Player'
            const postTitle = post.title.length > 30 ? post.title.slice(0, 27) + '...' : post.title
            const { sendPushNotification } = await import('@/lib/push/send')
            await Promise.all(
              subs.map((sub: any) =>
                sendPushNotification(sub.id, sub.subscription_json, {
                  title: `Forum: ${postTitle}`,
                  body: `${commenterName} replied to the thread`,
                  url: `/forum/${params.postId}`
                })
              )
            )
          }
        }
      }
    } catch (e) {
      console.error('Failed to trigger comment push notification:', e)
    }
  })()

  return NextResponse.json(data)
}
