"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, Circle } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { subscribeToNotifications } from '@/lib/supabase/realtime'
import { Toast } from '@/components/ui/Toast'

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/notifications')
        const data = await res.json()
        if (data.notifications) {
          setNotifications(data.notifications)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchNotifications()
  }, [])

  useEffect(() => {
    if (!userId) return
    const channel = subscribeToNotifications(userId, (newNotif) => {
      setToastMessage(`🏟️ New match activity detected!`)
      fetch('/api/notifications').then(r => r.json()).then(d => {
        if (d.notifications) setNotifications(d.notifications)
      })
    })
    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'PATCH' })
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
    } catch (e) {
      console.error(e)
    }
  }

  const handleNotificationClick = async (n: any) => {
    if (!n.is_read) {
      try {
        await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
        setNotifications(notifications.map(notif => notif.id === n.id ? { ...notif, is_read: true } : notif))
      } catch (e) {
        console.error(e)
      }
    }
    setIsOpen(false)
    if (n.group_id && n.booking_id) {
      router.push(`/groups/${n.group_id}/match/${n.booking_id}`)
    }
  }

  return (
    <>
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      <button onClick={() => setIsOpen(true)} className="relative p-2 rounded-full bg-white shadow-sm border border-neutral-100 hover:bg-neutral-50 active:scale-95 transition-all">
        <Bell className="w-5 h-5 text-neutral-600" />
        {unreadCount > 0 && (
          <div className="absolute top-0 right-0 -mt-1 -mr-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-black text-white border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/60 p-4 pb-0 sm:pb-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-0 shadow-2xl animate-in slide-in-from-bottom-full duration-200 flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-neutral-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 flex flex-col gap-3">
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-sm text-neutral-400 font-bold">No notifications yet.</div>
              ) : (
                notifications.map((n: any) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)}
                    className={`relative p-4 rounded-2xl border cursor-pointer active:scale-[0.98] transition-transform ${n.is_read ? 'bg-white border-neutral-100' : 'bg-green-50/50 border-green-200'}`}
                  >
                    {!n.is_read && <Circle className="absolute top-4 right-4 w-2.5 h-2.5 fill-green-500 text-green-500" />}
                    
                    <div className="flex flex-col gap-1 pr-6">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-1.5 py-0.5 rounded w-max mb-1">
                        {n.group_name || 'Kickoff'}
                      </span>
                      <p className={`text-sm ${n.is_read ? 'text-neutral-600' : 'text-neutral-900 font-bold'}`}>
                        {n.message}
                      </p>
                      {n.match_date && (
                        <p className="text-xs text-neutral-500 mt-1">Match: {format(parseISO(n.match_date), 'MMM d, yyyy')}</p>
                      )}
                      <p className="text-[10px] text-neutral-400 mt-2 font-medium">
                        {n.created_at ? formatDistanceToNow(parseISO(n.created_at), { addSuffix: true }) : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
