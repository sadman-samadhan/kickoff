/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MessageSquare, Plus, X, Loader2, Users, HelpCircle, Megaphone, Swords, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

const CATEGORIES = [
  { key: 'all', label: 'All', icon: MessageSquare, color: 'bg-neutral-100 text-neutral-700' },
  { key: 'general', label: 'General', icon: MessageSquare, color: 'bg-green-100 text-green-700' },
  { key: 'looking_for_players', label: 'Looking for Players', icon: Users, color: 'bg-blue-100 text-blue-700' },
  { key: 'match_invite', label: 'Match Invite', icon: Swords, color: 'bg-purple-100 text-purple-700' },
  { key: 'question', label: 'Question', icon: HelpCircle, color: 'bg-amber-100 text-amber-700' },
  { key: 'announcement', label: 'Announcement', icon: Megaphone, color: 'bg-red-100 text-red-700' },
]

const getCategoryStyle = (cat: string) => {
  const found = CATEGORIES.find(c => c.key === cat)
  return found?.color || 'bg-neutral-100 text-neutral-700'
}

const getCategoryLabel = (cat: string) => {
  const found = CATEGORIES.find(c => c.key === cat)
  return found?.label || cat
}

export default function ForumPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', content: '', category: 'general' })
  const [isCreating, setIsCreating] = useState(false)

  const fetchPosts = async (category?: string) => {
    setLoading(true)
    try {
      const cat = category || activeCategory
      const res = await fetch(`/api/forum/posts?category=${cat}&limit=30`)
      const data = await res.json()
      if (Array.isArray(data)) setPosts(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.title.trim() || !createForm.content.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      })
      const data = await res.json()
      if (data.id) {
        setPosts(prev => [{ ...data, comment_count: 0 }, ...prev])
        setIsCreateOpen(false)
        setCreateForm({ title: '', content: '', category: 'general' })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 pt-6 max-w-xl mx-auto min-h-screen pb-24">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight leading-none mb-1">Forum</h1>
          <p className="text-sm text-neutral-500 font-medium">Discuss, find players, and invite teams</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white rounded-full shadow-md shadow-green-600/20"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" /> Post
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar snap-x -mx-4 px-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all snap-start shrink-0 ${
              activeCategory === cat.key
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-12 text-center">
          <MessageSquare className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="font-bold text-neutral-900 mb-1">No posts yet</h3>
          <p className="text-sm text-neutral-500">Be the first to start a discussion!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => (
            <Link href={`/forum/${post.id}`} key={post.id}>
              <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm hover:shadow-md transition-shadow active:scale-[0.99]">
                <div className="flex items-start gap-3">
                  {post.author?.avatar_url ? (
                    <div className="w-10 h-10 rounded-full border border-neutral-100 shrink-0 overflow-hidden relative">
                      <Image src={post.author.avatar_url} alt="" fill sizes="40px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-sm border border-green-200 shrink-0">
                      {post.author?.full_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 text-sm leading-tight mb-1 line-clamp-2">{post.title}</h3>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed mb-2">{post.content}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getCategoryStyle(post.category)}`}>
                        {getCategoryLabel(post.category)}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {post.author?.full_name || post.author?.username || 'Player'} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                      <span className="text-[10px] text-neutral-400 flex items-center gap-1 ml-auto">
                        <MessageSquare className="w-3 h-3" /> {post.comment_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Post Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
          <div className="bg-white w-full max-w-md max-h-[85vh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-neutral-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-green-600" /> New Post
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <form id="create-post-form" onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="What's on your mind?"
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    value={createForm.title}
                    onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Category</label>
                  <select
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm bg-white"
                    value={createForm.category}
                    onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                  >
                    {CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                      <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Content</label>
                  <textarea
                    required
                    placeholder="Share more details..."
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm min-h-[120px] resize-none"
                    value={createForm.content}
                    onChange={e => setCreateForm({ ...createForm, content: e.target.value })}
                    maxLength={2000}
                  />
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-neutral-100 bg-white shrink-0 sm:rounded-b-3xl">
              <Button
                form="create-post-form"
                type="submit"
                disabled={isCreating}
                className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl text-base shadow-sm"
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publish Post'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
