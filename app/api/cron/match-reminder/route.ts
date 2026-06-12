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
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('*, groups(name)')
      .eq('status', 'upcoming')
      .eq('reminder_sent', false)

    if (bookingsError) throw bookingsError

    const now = new Date()
    const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000)
    let remindersSent = 0

    for (const b of bookings || []) {
      const matchDateTime = new Date(`${b.match_date}T${b.match_time}`)

      if (matchDateTime > now && matchDateTime <= twelveHoursFromNow) {
        const { data: rsvps, error: rsvpsError } = await supabaseAdmin
          .from('rsvps')
          .select('profiles(id, email, full_name, email_notifications)')
          .eq('booking_id', b.id)
          .eq('status', 'in')

        if (rsvpsError) continue

        const groupName = (b.groups as any)?.name || 'Group'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        for (const r of rsvps || []) {
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : (r.profiles as any)
          if (!profile || !profile.email || profile.email_notifications === false) continue

          await sendEmail({
            to: profile.email,
            subject: `⏰ Match Reminder: ${groupName} — KhelaHobe`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #16a34a;">Match Reminder!</h2>
                <p>Hi ${profile.full_name?.split(' ')[0] || 'Player'},</p>
                <p>This is a reminder that you are RSVP'd <strong>IN</strong> for the match in <strong>${groupName}</strong>.</p>
                <div style="background-color: #f0fdf4; padding: 15px; border-radius: 10px; margin: 20px 0; border: 1px solid #bbf7d0;">
                  <p style="margin: 5px 0;">📅 <strong>Date:</strong> ${b.match_date}</p>
                  <p style="margin: 5px 0;">⏰ <strong>Time:</strong> ${b.match_time.slice(0, 5)}</p>
                  <p style="margin: 5px 0;">📍 <strong>Field:</strong> ${b.field_name}</p>
                </div>
                <p>Get your gear ready and show up on time!</p>
                <p style="margin-top: 30px;">
                  <a href="${appUrl}/groups/${b.group_id}" style="background-color: #16a34a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Match Details</a>
                </p>
                <hr style="margin-top: 40px; border: 0; border-top: 1px solid #eee;" />
                <p style="font-size: 11px; color: #999;">If you wish to stop receiving these notifications, you can disable email notifications in your profile settings.</p>
              </div>
            `
          })
        }

        await supabaseAdmin
          .from('bookings')
          .update({ reminder_sent: true })
          .eq('id', b.id)

        remindersSent++
      }
    }

    return NextResponse.json({ success: true, remindersSent })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
