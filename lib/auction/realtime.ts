// Channel naming shared by the server (broadcast pings) and the client (subscribe + presence).
export const auctionTopic = (auctionId: string) => `auction:${auctionId}`
export const PING_EVENT = 'ping'
