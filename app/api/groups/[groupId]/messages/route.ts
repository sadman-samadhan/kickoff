/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { groupId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const before = searchParams.get('before') // cursor-based pagination

  const supabaseAdmin = createAdminClient()
  let query = supabaseAdmin
    .from('group_messages')
    .select('*, profiles(full_name, username, avatar_url)')
    .eq('group_id', params.groupId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const formattedData = (data?.reverse() || []).map(msg => ({
    ...msg,
    sender: Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles
  }))

  console.log("FORMATTED MESSAGES PREVIEW:", JSON.stringify(formattedData.slice(0,2), null, 2))

  return NextResponse.json(formattedData)
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
    .select('*, profiles(full_name, username, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  const formattedData = {
    ...data,
    sender: data.profiles
  };

  // Trigger push notifications in background
  ;(async () => {
    try {
      const supabaseAdmin = createAdminClient()
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('name')
        .eq('id', params.groupId)
        .single()

      const groupName = group?.name || 'Group'
      const senderName = formattedData.sender?.full_name || formattedData.sender?.username || 'Someone'

      const { data: members } = await supabaseAdmin
        .from('group_members')
        .select(`
          player_id,
          profiles:profiles!player_id (
            push_msg_enabled
          )
        `)
        .eq('group_id', params.groupId)
        .neq('player_id', user.id)

      if (members && members.length > 0) {
        const subscriberIds = members
          .filter(m => {
            const p = Array.isArray(m.profiles) ? m.profiles[0] : (m.profiles as any)
            return p && p.push_msg_enabled !== false
          })
          .map(m => m.player_id)

        if (subscriberIds.length > 0) {
          const { data: subs } = await supabaseAdmin
            .from('push_subscriptions')
            .select('id, subscription_json')
            .in('user_id', subscriberIds)

          if (subs && subs.length > 0) {
            const { sendPushNotification } = await import('@/lib/push/send')
            await Promise.all(
              subs.map((sub: any) =>
                sendPushNotification(sub.id, sub.subscription_json, {
                  title: `${groupName} Chat`,
                  body: `${senderName}: ${content.trim()}`,
                  url: `/groups/${params.groupId}?tab=chat`
                })
              )
            )
          }
        }
      }
    } catch (e) {
      console.error('Failed to trigger message push notification:', e)
    }
  })()

  return NextResponse.json(formattedData)
}
