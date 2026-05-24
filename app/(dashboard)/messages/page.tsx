
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircle, Loader2, Users } from 'lucide-react'
import { useChatUnread } from '@/components/providers/ChatUnreadProvider'

export default function MessagesPage() {
  const { unreadCounts } = useChatUnread()
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups')
        const data = await res.json()
        if (Array.isArray(data)) setGroups(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchGroups()
  }, [])

  return (
    <div className="flex flex-col gap-5 p-4 pt-6 max-w-xl mx-auto min-h-screen pb-24">
      <div>
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight leading-none mb-1">Messages</h1>
        <p className="text-sm text-neutral-500 font-medium">Your group conversations</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-12 text-center">
          <MessageCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="font-bold text-neutral-900 mb-1">No groups yet</h3>
          <p className="text-sm text-neutral-500">Join or create a group to start chatting.</p>
          <Link href="/groups" className="inline-block mt-4 text-green-600 font-bold text-sm">
            Browse Groups →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group: any) => {
            const unread = unreadCounts[group.id] || 0
            
            return (
              <Link href={`/groups/${group.id}?tab=chat`} key={group.id}>
                <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98]">
                  <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-lg border border-green-200 shrink-0 relative">
                    {group.name?.charAt(0) || 'G'}
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm truncate ${unread > 0 ? 'font-black text-neutral-900' : 'font-bold text-neutral-800'}`}>
                      {group.name}
                    </h3>
                    <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3" />
                      {group.member_count || 0} members
                    </p>
                  </div>
                  <div className="flex items-center justify-center relative">
                    <MessageCircle className={`w-5 h-5 ${unread > 0 ? 'text-green-600 fill-green-50' : 'text-neutral-400'}`} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
