// Link previews: WhatsApp, Messenger, Telegram etc. fetch a pasted link without being signed in. For a matchday
// link we show them a public preview page (title, result image) instead of the login redirect.
// Everything on that preview is also in the image anyone in the chat can see; nothing private is exposed.

// Link fetchers only: in-app browsers (LINE, Viber, Pinterest…) are real people and must reach the login page.
const PREVIEW_BOTS = /whatsapp\/|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|embedly|iframely|redditbot/i

export function isLinkPreviewBot(userAgent: string | null | undefined) {
  return !!userAgent && PREVIEW_BOTS.test(userAgent)
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MATCHDAY_PATH = new RegExp(`^/groups/${UUID}/match/(${UUID})(?:/game/${UUID})?/?$`, 'i')

/** The booking id in a matchday (or scoring) URL, or null. */
export function matchdayIdFromPath(pathname: string) {
  return MATCHDAY_PATH.exec(pathname)?.[1]?.toLowerCase() ?? null
}
