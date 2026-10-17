"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface ChatUnreadContextType {
  unreadCounts: Record<string, number>
  totalUnread: number
  markAsRead: (groupId: string) => void
  refreshCounts: () => void
}

const ChatUnreadContext = createContext<ChatUnreadContextType>({
  unreadCounts: {},
  totalUnread: 0,
  markAsRead: () => {},
  refreshCounts: () => {}
})

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [totalUnread, setTotalUnread] = useState(0)

  const refreshCounts = useCallback(async () => {
    try {
      // Send the "last read" time we know for each group; the server works out the user's groups itself.
      const timestamps: Record<string, number> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('chat_last_read_')) {
          const ts = parseInt(localStorage.getItem(key) || '', 10)
          if (!isNaN(ts)) timestamps[key.slice('chat_last_read_'.length)] = ts
        }
      }

      const countsRes = await fetch('/api/messages/unread-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupReadTimestamps: timestamps })
      })

      if (countsRes.ok) {
        const counts = await countsRes.json() as Record<string, number>
        setUnreadCounts(counts)
        setTotalUnread(Object.values(counts).reduce((a, b) => a + b, 0))
      }
    } catch (e) {
      console.error('Failed to fetch unread chat counts', e)
    }
  }, [])

  useEffect(() => {
    // Poll only while the tab is visible; refresh as soon as it comes back.
    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (interval) return
      refreshCounts()
      interval = setInterval(refreshCounts, 60000)
    }
    const stop = () => {
      if (interval) clearInterval(interval)
      interval = null
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop())
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshCounts])

  const markAsRead = useCallback(async (groupId: string) => {
    localStorage.setItem(`chat_last_read_${groupId}`, Date.now().toString())
    setUnreadCounts(prev => {
      const newCounts = { ...prev, [groupId]: 0 }
      setTotalUnread(Object.values(newCounts).reduce((a, b) => a + b, 0))
      return newCounts
    })
    try {
      await fetch(`/api/groups/${groupId}/read`, { method: 'POST' })
    } catch (e) {
      console.error('Failed to sync read status to database:', e)
    }
  }, [])

  return (
    <ChatUnreadContext.Provider value={{ unreadCounts, totalUnread, markAsRead, refreshCounts }}>
      {children}
    </ChatUnreadContext.Provider>
  )
}

export const useChatUnread = () => useContext(ChatUnreadContext)
