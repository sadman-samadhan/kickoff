/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from 'react'
import { Plus, Link as LinkIcon, Users, Clock, Calendar, Shield, X, Copy, Loader2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { createGroupAction, joinGroupAction } from './actions'
import { Button } from '@/components/ui/button'

export default function GroupsClient({ initialGroups }: { initialGroups: any[] }) {
  const router = useRouter()
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState<{name: string, code: string} | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) return
    setIsLoading(true)
    setError('')
    
    try {
      const { group } = await createGroupAction(createName)
      setSuccessData({ name: group.name, code: group.invite_code })
      setCreateName('')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create group')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setIsLoading(true)
    setError('')
    
    try {
      const { groupId } = await joinGroupAction(joinCode)
      setIsJoinModalOpen(false)
      setJoinCode('')
      router.push(`/groups/${groupId}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to join group')
    } finally {
      setIsLoading(false)
    }
  }

  const copyInviteCode = () => {
    if (successData?.code) {
      navigator.clipboard.writeText(successData.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setSuccessData(null)
    setError('')
    setCreateName('')
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto h-full">
      <h1 className="text-2xl font-bold text-neutral-900">My Groups</h1>

      <div className="flex flex-col gap-4">
        {initialGroups.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-neutral-100 shadow-sm flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-bold text-neutral-900 mb-1">No groups yet</h3>
            <p className="text-sm text-neutral-500">Create a new group or join an existing one to start playing.</p>
          </div>
        ) : (
          initialGroups.map((group) => (
            <Link href={`/groups/${group.id}`} key={group.id}>
              <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm active:scale-[0.98] transition-transform">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-neutral-900 text-lg">{group.name}</h3>
                    {group.role === 'admin' && (
                      <Shield className="w-4 h-4 text-green-600 fill-green-50" />
                    )}
                  </div>
                  <div className="bg-neutral-50 px-2.5 py-1 rounded-full border border-neutral-100 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-xs font-bold text-neutral-700">{group.memberCount}</span>
                  </div>
                </div>

                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mb-1.5">Next Match</div>
                  {group.nextMatch ? (
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
                          <Calendar className="w-3.5 h-3.5 text-green-600" />
                          {format(parseISO(group.nextMatch.date), 'EEEE, MMM d')}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
                          <Clock className="w-3.5 h-3.5 text-green-600" />
                          {group.nextMatch.time.slice(0,5)}
                        </div>
                      </div>
                      <div>
                        {group.nextMatch.rsvp === 'in' && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">IN</span>}
                        {group.nextMatch.rsvp === 'out' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">OUT</span>}
                        {group.nextMatch.rsvp === 'pending' && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">PENDING</span>}
                        {group.nextMatch.rsvp === 'none' && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">ACTION REQ</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-neutral-500 font-medium">No matches scheduled</div>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white shadow-sm h-12 rounded-xl text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Create Group
        </Button>
        <Button 
          onClick={() => setIsJoinModalOpen(true)}
          variant="outline"
          className="bg-white border-green-200 text-green-700 hover:bg-green-50 shadow-sm h-12 rounded-xl text-sm"
        >
          <LinkIcon className="w-4 h-4 mr-1.5" /> Join Group
        </Button>
      </div>

      {/* CREATE MODAL / SHEET */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/40 p-4 pb-0 sm:pb-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900">Create New Group</h3>
              <button onClick={closeCreateModal} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {successData ? (
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xl text-neutral-900 mb-1">{successData.name} Created!</h4>
                    <p className="text-sm text-neutral-500">Share this code with your friends so they can join the squad.</p>
                  </div>
                  
                  <div className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-4 mt-2">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Invite Code</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white border border-neutral-200 rounded-lg py-2.5 px-3 text-lg font-mono font-bold tracking-widest text-center text-neutral-800">
                        {successData.code}
                      </div>
                      <Button onClick={copyInviteCode} variant="outline" className="h-[46px] w-[46px] p-0 shrink-0 border-neutral-200 bg-white">
                        {copied ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-neutral-600" />}
                      </Button>
                    </div>
                  </div>
                  
                  <Button onClick={closeCreateModal} className="w-full bg-neutral-900 hover:bg-neutral-800 text-white h-12 mt-2 rounded-xl">
                    Done
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreateGroup} className="space-y-4">
                  {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-neutral-700">Group Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                      placeholder="e.g. Sunday League Legends"
                      value={createName}
                      onChange={e => setCreateName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  
                  <Button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl mt-4">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Group'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JOIN MODAL / SHEET */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/40 p-4 pb-0 sm:pb-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900">Join a Group</h3>
              <button onClick={() => { setIsJoinModalOpen(false); setError(''); setJoinCode('') }} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleJoinGroup} className="space-y-4">
                {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-neutral-700">Invite Code or Link</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm font-mono"
                    placeholder="Paste code here..."
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-neutral-500 mt-1">Ask your group admin for the 8-character invite code.</p>
                </div>
                
                <Button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl mt-4">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join Group'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
      
      <div className="h-4"></div>
    </div>
  )
}
