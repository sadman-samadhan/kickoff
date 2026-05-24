/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Send, Loader2 } from 'lucide-react'

import { useChatUnread } from '@/components/providers/ChatUnreadProvider'

interface ChatMessage {
  id: string
  group_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: { full_name: string; username?: string; avatar_url: string | null }
}

export default function ChatTab({ groupId, userId }: { groupId: string; userId: string }) {
  const { markAsRead } = useChatUnread()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const [myProfile, setMyProfile] = useState<{ full_name: string; username?: string; avatar_url: string | null } | null>(null)
  
  useEffect(() => {
    markAsRead(groupId)
    // Fetch our own profile so we can inject it immediately when sending messages
    const fetchMyProfile = async () => {
      const { data } = await createClient().from('profiles').select('full_name, username, avatar_url').eq('id', userId).single()
      if (data) setMyProfile(data)
    }
    fetchMyProfile()
  }, [groupId, userId, markAsRead])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Fetch initial messages
  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch(`/api/groups/${groupId}/messages?limit=50`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setMessages(data)
        }
      } catch (e) {
        console.error('Failed to fetch messages', e)
      } finally {
        setLoading(false)
      }
    }
    fetchMessages()
  }, [groupId])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Subscribe to real-time messages
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`
        },
        async (payload) => {
          const newMsg = payload.new as any
          
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, {
              ...newMsg,
              sender: { full_name: 'Loading...', avatar_url: null }
            }]
          })
          
          // Always fetch profile for Realtime events since they don't contain joins
          if (newMsg.sender_id === userId && myProfile) {
            // It's our own message, no need to fetch!
            setMessages(prev => prev.map(m => 
              m.id === newMsg.id ? { ...m, sender: myProfile } : m
            ))
          } else {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, username, avatar_url')
                .eq('id', newMsg.sender_id)
                .single()
              
              if (profile) {
                setMessages(prev => prev.map(m => 
                  m.id === newMsg.id ? { ...m, sender: profile } : m
                ))
              } else {
                setMessages(prev => prev.map(m => 
                  m.id === newMsg.id ? { ...m, sender: { full_name: 'Player', avatar_url: null } } : m
                ))
              }
            } catch (e) {
              console.error(e)
              setMessages(prev => prev.map(m => 
                m.id === newMsg.id ? { ...m, sender: { full_name: 'Player', avatar_url: null } } : m
              ))
            }
          }
          
          // Since we are actively on the chat tab, mark as read immediately
          markAsRead(groupId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [groupId, userId, myProfile, markAsRead])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)

    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      const data = await res.json()
      if (data.id) {
        if (!data.sender && myProfile) {
          data.sender = myProfile
        }
        setMessages(prev => {
          const exists = prev.find(m => m.id === data.id)
          if (exists) {
            return prev.map(m => m.id === data.id ? data : m)
          }
          return [...prev, data]
        })
        markAsRead(groupId)
      }
    } catch (e) {
      console.error('Failed to send message', e)
      setNewMessage(content) // Restore on failure
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffHrs = diffMs / (1000 * 60 * 60)

    if (diffHrs < 24) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (diffHrs < 168) { // 7 days
      return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      {/* Messages Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Send className="w-7 h-7 text-green-400" />
            </div>
            <h3 className="font-bold text-neutral-900 mb-1">No messages yet</h3>
            <p className="text-sm text-neutral-500">Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.sender_id === userId
            const senderInfo = msg.sender || msg.profiles
            const displayName = senderInfo?.full_name || senderInfo?.username || 'Player'
            const avatarUrl = senderInfo?.avatar_url
            
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && (
                  <div className="shrink-0 mt-1">
                    {avatarUrl ? (
                      <div className="w-8 h-8 rounded-full border border-neutral-100 overflow-hidden relative">
                        <Image src={avatarUrl} alt="" fill sizes="32px" className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-xs border border-green-200 uppercase">
                        {displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                )}
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <p className="text-[10px] font-bold text-neutral-400 mb-0.5 ml-1">
                      {displayName}
                    </p>
                  )}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe 
                      ? 'bg-green-600 text-white rounded-br-md' 
                      : 'bg-neutral-100 text-neutral-800 rounded-bl-md'
                  }`}>
                    {msg.content}
                  </div>
                  <p className={`text-[9px] text-neutral-400 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-neutral-100 bg-neutral-50/50 flex items-center gap-2">
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="w-10 h-10 bg-green-600 hover:bg-green-700 disabled:bg-neutral-200 text-white rounded-full flex items-center justify-center transition-colors shrink-0 active:scale-95"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
