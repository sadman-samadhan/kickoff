import { createClient } from './client'

export function subscribeToNotifications(userId: string, onNewNotification: (n: any) => void) {
  const supabase = createClient()
  
  const channel = supabase
    .channel(`notifications:player_id=eq.${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `player_id=eq.${userId}`
      },
      (payload) => {
        onNewNotification(payload.new)
      }
    )
    .subscribe()
    
  return channel
}
