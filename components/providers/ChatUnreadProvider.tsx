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
      // Get all group IDs from localStorage that we track, or we could fetch groups API.
      // But we need the list of user's groups to get accurate counts even for groups they haven't opened yet.
      const res = await fetch('/api/groups')
      const groups = await res.json()
      
      if (!Array.isArray(groups)) return

      const timestamps: Record<string, number> = {}
      groups.forEach((g: { id: string }) => {
        const lastRead = localStorage.getItem(`chat_last_read_${g.id}`)
        timestamps[g.id] = lastRead ? parseInt(lastRead, 10) : 0 // 0 means fetch all unread since epoch
      })

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
    refreshCounts()
    // Refresh every 30 seconds
    const interval = setInterval(refreshCounts, 30000)
    return () => clearInterval(interval)
  }, [refreshCounts])

  const markAsRead = useCallback((groupId: string) => {
    localStorage.setItem(`chat_last_read_${groupId}`, Date.now().toString())
    setUnreadCounts(prev => {
      const newCounts = { ...prev, [groupId]: 0 }
      setTotalUnread(Object.values(newCounts).reduce((a, b) => a + b, 0))
      return newCounts
    })
  }, [])

  return (
    <ChatUnreadContext.Provider value={{ unreadCounts, totalUnread, markAsRead, refreshCounts }}>
      {children}
    </ChatUnreadContext.Provider>
  )
}

export const useChatUnread = () => useContext(ChatUnreadContext)
