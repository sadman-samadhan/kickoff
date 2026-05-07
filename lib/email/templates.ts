interface EmailParams {
  playerName: string
  groupName: string
  matchDate: string
  matchTime: string
  fieldName: string
  inUrl?: string
  outUrl?: string
}

export function bookingNotificationEmail({ playerName, groupName, matchDate, matchTime, fieldName, inUrl, outUrl }: EmailParams) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #171717;">
      <h2 style="color: #16a34a;">⚽ New Match Added — ${groupName}</h2>
      <p>Hey <strong>${playerName}</strong>!</p>
      <p><strong>${groupName}</strong> has a match coming up.</p>
      <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;">📅 <strong>Date:</strong> ${matchDate}</p>
        <p style="margin: 0 0 8px 0;">⏰ <strong>Time:</strong> ${matchTime}</p>
        <p style="margin: 0;">📍 <strong>Field:</strong> ${fieldName}</p>
      </div>
      <p>Are you in? Click below to confirm your spot.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="${inUrl}" style="background-color: #16a34a; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
          I'm In ✅
        </a>
      </div>
      <div style="text-align: center; margin-top: 20px;">
        <a href="${outUrl}" style="color: #6b7280; text-decoration: underline; font-size: 14px;">
          Can't Make It ❌
        </a>
      </div>
    </div>
  `
}

export function waitlistPromotionEmail({ playerName, groupName, matchDate, matchTime, fieldName }: EmailParams) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #171717;">
      <h2 style="color: #16a34a;">🎉 You're In!</h2>
      <p>Great news <strong>${playerName}</strong>! A spot opened up for the <strong>${groupName}</strong> match.</p>
      <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;">📅 <strong>Date:</strong> ${matchDate}</p>
        <p style="margin: 0 0 8px 0;">⏰ <strong>Time:</strong> ${matchTime}</p>
        <p style="margin: 0;">📍 <strong>Field:</strong> ${fieldName}</p>
      </div>
      <p>You've been moved from the waitlist to the squad! See you on the pitch.</p>
    </div>
  `
}

export function rsvpReminderEmail({ playerName, groupName, matchDate, matchTime, fieldName, inUrl, outUrl }: EmailParams) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #171717;">
      <h2 style="color: #d97706;">⏰ Action Required: Confirm your spot</h2>
      <p>Hey <strong>${playerName}</strong>!</p>
      <p>You haven't responded yet for the upcoming match with <strong>${groupName}</strong>.</p>
      <div style="background-color: #fffbeb; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;">📅 <strong>Date:</strong> ${matchDate}</p>
        <p style="margin: 0 0 8px 0;">⏰ <strong>Time:</strong> ${matchTime}</p>
        <p style="margin: 0;">📍 <strong>Field:</strong> ${fieldName}</p>
      </div>
      <p>Let the team know if you're coming!</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="${inUrl}" style="background-color: #16a34a; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
          I'm In ✅
        </a>
      </div>
      <div style="text-align: center; margin-top: 20px;">
        <a href="${outUrl}" style="color: #6b7280; text-decoration: underline; font-size: 14px;">
          Can't Make It ❌
        </a>
      </div>
    </div>
  `
}
