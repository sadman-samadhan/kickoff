/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, MessageSquare, Send, Loader2, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import ConfirmModal from '@/components/modals/ConfirmModal'

export default function ForumPostPage({ params }: { params: { postId: string } }) {
  const { postId } = params
  const router = useRouter()
  const [post, setPost] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    async function fetchPost() {
      try {
        const res = await fetch(`/api/forum/posts/${postId}`)
        const data = await res.json()
        if (data.post) {
          setPost(data.post)
          setComments(data.comments || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchPost()
  }, [postId])

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isSending) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() })
      })
      const data = await res.json()
      if (data.id) {
        setComments(prev => [...prev, data])
        setNewComment('')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSending(false)
    }
  }

  const handleDeletePost = async () => {
    try {
      await fetch(`/api/forum/posts/${postId}`, { method: 'DELETE' })
      router.push('/forum')
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <MessageSquare className="w-12 h-12 text-neutral-300 mb-3" />
        <h2 className="font-bold text-lg text-neutral-900">Post not found</h2>
        <Link href="/forum" className="text-green-600 font-bold text-sm mt-2">← Back to Forum</Link>
      </div>
    )
  }

  const CATEGORY_LABELS: Record<string, string> = {
    general: 'General',
    looking_for_players: 'Looking for Players',
    match_invite: 'Match Invite',
    question: 'Question',
    announcement: 'Announcement',
  }

  return (
    <div className="flex flex-col gap-5 p-4 pt-6 max-w-xl mx-auto min-h-screen pb-32">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/forum" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-neutral-200 text-neutral-500">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </Link>
        <h1 className="text-lg font-bold text-neutral-900 truncate">Discussion</h1>
      </div>

      {/* Post Card */}
      <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          {post.author?.avatar_url ? (
            <div className="w-11 h-11 rounded-full border border-neutral-100 overflow-hidden relative shrink-0">
              <Image src={post.author.avatar_url} alt="" fill sizes="44px" className="object-cover" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-lg border border-green-200">
              {post.author?.full_name?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-neutral-900 text-sm">{post.author?.full_name || post.author?.username || 'Player'}</p>
            <p className="text-[10px] text-neutral-400">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
          </div>
          <button onClick={() => setIsDeleteModalOpen(true)} className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-green-100 text-green-700 mb-3">
          {CATEGORY_LABELS[post.category] || post.category}
        </span>

        <h2 className="text-xl font-black text-neutral-900 leading-tight mb-3">{post.title}</h2>
        <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Comments */}
      <div>
        <h3 className="font-bold text-neutral-900 text-lg mb-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-neutral-400" /> Replies ({comments.length})
        </h3>

        {comments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center">
            <p className="text-sm text-neutral-500">No replies yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment: any) => (
              <div key={comment.id} className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
                <div className="flex items-center gap-2.5 mb-2">
                  {comment.author?.avatar_url ? (
                    <div className="w-8 h-8 rounded-full border border-neutral-100 overflow-hidden relative shrink-0">
                      <Image src={comment.author.avatar_url} alt="" fill sizes="32px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-xs border border-green-200">
                      {comment.author?.full_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-neutral-800 text-xs leading-none">{comment.author?.full_name || comment.author?.username || 'Player'}</p>
                    <p className="text-[9px] text-neutral-400 mt-0.5">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comment Input - Fixed at bottom */}
      <div className="fixed bottom-[76px] left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-neutral-100 p-3 z-30">
        <form onSubmit={handleAddComment} className="flex items-center gap-2 max-w-xl mx-auto">
          <input
            type="text"
            placeholder="Write a reply..."
            className="flex-1 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSending}
            className="w-10 h-10 bg-green-600 hover:bg-green-700 disabled:bg-neutral-200 text-white rounded-full flex items-center justify-center transition-colors shrink-0 active:scale-95"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDeletePost}
        onCancel={() => setIsDeleteModalOpen(false)}
        isDestructive={true}
      />
    </div>
  )
}
