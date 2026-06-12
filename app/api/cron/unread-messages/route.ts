/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()

  try {
    const { data: members, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select(`
        id,
        group_id,
        player_id,
        last_read_at,
        last_unread_email_sent_at,
        groups ( name ),
        profiles:profiles!player_id ( email, full_name, email_notifications )
      `)

    if (membersError) throw membersError

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    let emailsSent = 0

    for (const member of members || []) {
      const profile = Array.isArray(member.profiles) ? member.profiles[0] : (member.profiles as any)
      if (!profile || !profile.email || profile.email_notifications === false) continue

      if (member.last_unread_email_sent_at && new Date(member.last_unread_email_sent_at) > new Date(member.last_read_at)) {
        continue
      }

      const { data: unreadMsgs, error: msgsError } = await supabaseAdmin
        .from('group_messages')
        .select('id, content, created_at')
        .eq('group_id', member.group_id)
        .neq('sender_id', member.player_id)
        .gt('created_at', new Date(member.last_read_at || 0).toISOString())
        .lt('created_at', twentyFourHoursAgo.toISOString())
        .limit(1)

      if (msgsError) continue

      if (unreadMsgs && unreadMsgs.length > 0) {
        const groupName = (member.groups as any)?.name || 'your group'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        await sendEmail({
          to: profile.email,
          subject: `💬 Unread messages in ${groupName} — KhelaHobe`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #16a34a;">Hi ${profile.full_name?.split(' ')[0] || 'Player'},</h2>
              <p>You have unread messages in <strong>${groupName}</strong> that have been waiting for over 24 hours.</p>
              <p>Don't miss the discussion! Head over to the app to read and reply.</p>
              <p style="margin-top: 30px;">
                <a href="${appUrl}/groups/${member.group_id}" style="background-color: #16a34a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Open Chat</a>
              </p>
              <hr style="margin-top: 40px; border: 0; border-top: 1px solid #eee;" />
              <p style="font-size: 11px; color: #999;">If you wish to stop receiving these notifications, you can disable email notifications in your profile settings.</p>
            </div>
          `
        })

        await supabaseAdmin
          .from('group_members')
          .update({ last_unread_email_sent_at: now.toISOString() })
          .eq('id', member.id)

        emailsSent++
      }
    }

    return NextResponse.json({ success: true, emailsSent })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
