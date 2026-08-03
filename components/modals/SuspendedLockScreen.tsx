/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from 'react'
import Link from 'next/link'
import { AlertOctagon, Mail, Send, CheckCircle2, User, LogOut, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { submitAdminAppealAction } from '@/app/(dashboard)/admin/actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SuspendedLockScreen() {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setIsSubmitting(true)
    try {
      await submitAdminAppealAction(subject, message)
      setSubmittedSuccess(true)
      setSubject('')
      setMessage('')
    } catch (err: any) {
      alert(err.message || 'Failed to send appeal')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950 text-white flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6 my-auto">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner">
            <AlertOctagon className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Account Suspended</h1>
          <p className="text-xs text-neutral-400 font-medium leading-relaxed max-w-xs">
            Your account has been restricted by Site Administration due to a policy violation or system review.
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-rose-950/40 border border-rose-800/40 rounded-2xl p-4 text-xs text-rose-200 space-y-1">
          <span className="font-bold block uppercase tracking-wider text-[10px] text-rose-400">Access Restricted</span>
          <p>You cannot schedule matches, join squads, chat, or post in forums while your account is suspended.</p>
        </div>

        {/* Contact Admin / Appeal Form */}
        <div className="bg-neutral-800/60 border border-neutral-700/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
            <Mail className="w-4 h-4 text-emerald-400" /> Contact Site Admin / Submit Appeal
          </div>

          {submittedSuccess ? (
            <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-xl p-4 text-center space-y-1 animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              <h4 className="text-xs font-bold text-emerald-200">Appeal Submitted!</h4>
              <p className="text-[11px] text-emerald-300/80">
                Your message has been sent directly to the site administrator. You will be notified when your account is reviewed.
              </p>
              <button
                onClick={() => setSubmittedSuccess(false)}
                className="text-[10px] text-emerald-400 underline font-bold mt-2 inline-block"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitAppeal} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Account reinstatement request"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs outline-none focus:border-emerald-500 font-medium text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Appeal Message</label>
                <textarea
                  rows={3}
                  placeholder="Explain why your account should be reinstated..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full p-3 bg-neutral-900 border border-neutral-700 rounded-xl text-xs outline-none focus:border-emerald-500 font-medium text-white"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Submit Appeal to Admin
              </Button>
            </form>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex gap-2 pt-1">
          <Link href="/profile" className="flex-1">
            <Button variant="outline" className="w-full h-11 rounded-xl border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs">
              <User className="w-4 h-4 mr-2" /> View Profile
            </Button>
          </Link>
          <Button
            onClick={handleSignOut}
            variant="destructive"
            className="flex-1 h-11 rounded-xl bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 text-xs"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
