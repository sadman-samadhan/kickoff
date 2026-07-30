/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from 'react'
import Link from 'next/link'
import {
  Shield, Users, Trophy, MapPin, Megaphone, Search, Plus,
  Edit3, Trash2, Ban, CheckCircle, ChevronRight, Loader2,
  Calendar, AlertTriangle, ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/select'
import ConfirmModal from '@/components/modals/ConfirmModal'
import {
  toggleUserSuspensionAction,
  createSystemBroadcastAction,
  saveFieldAction,
  deleteFieldAction
} from './actions'

interface AdminClientProps {
  stats: {
    totalUsers: number
    totalGroups: number
    totalBookings: number
    totalFields: number
  }
  users: any[]
  groups: any[]
  fields: any[]
  broadcasts: any[]
  currentUserId: string
}

export default function AdminClient({
  stats,
  users,
  groups,
  fields,
  broadcasts,
  currentUserId
}: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'broadcasts' | 'fields' | 'groups'>('overview')

  // Search & Filter State
  const [userSearch, setUserSearch] = useState('')
  const [userPosFilter, setUserPosFilter] = useState('ALL')

  // Broadcast Form State
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false)
  const [broadcastToast, setBroadcastToast] = useState<string | null>(null)

  // User Suspension Modal State
  const [suspensionModal, setSuspensionModal] = useState<{
    isOpen: boolean
    user: any | null
    suspend: boolean
    reason: string
  }>({ isOpen: false, user: null, suspend: true, reason: '' })
  const [isSuspending, setIsSuspending] = useState(false)

  // Field Form Modal State
  const [fieldModal, setFieldModal] = useState<{
    isOpen: boolean
    field: any | null
    name: string
    google_maps_url: string
  }>({ isOpen: false, field: null, name: '', google_maps_url: '' })
  const [isSavingField, setIsSavingField] = useState(false)

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  // Filter Users
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(userSearch.toLowerCase())
    const matchesPos = userPosFilter === 'ALL' || u.preferred_position === userPosFilter
    return matchesSearch && matchesPos
  })

  // Handlers
  const handleConfirmSuspension = async () => {
    if (!suspensionModal.user) return
    setIsSuspending(true)
    try {
      await toggleUserSuspensionAction(
        suspensionModal.user.id,
        suspensionModal.suspend,
        suspensionModal.reason
      )
      setSuspensionModal({ isOpen: false, user: null, suspend: true, reason: '' })
    } catch (e: any) {
      alert(e.message || 'Failed to update user status')
    } finally {
      setIsSuspending(false)
    }
  }

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return
    setIsSendingBroadcast(true)
    try {
      await createSystemBroadcastAction(broadcastTitle, broadcastMessage)
      setBroadcastTitle('')
      setBroadcastMessage('')
      setBroadcastToast('📢 Announcement sent to all user dashboards!')
      setTimeout(() => setBroadcastToast(null), 4000)
    } catch (e: any) {
      alert(e.message || 'Failed to send broadcast')
    } finally {
      setIsSendingBroadcast(false)
    }
  }

  const handleSaveField = async () => {
    if (!fieldModal.name.trim()) return
    setIsSavingField(true)
    try {
      await saveFieldAction({
        id: fieldModal.field?.id,
        name: fieldModal.name,
        google_maps_url: fieldModal.google_maps_url
      })
      setFieldModal({ isOpen: false, field: null, name: '', google_maps_url: '' })
    } catch (e: any) {
      alert(e.message || 'Failed to save field')
    } finally {
      setIsSavingField(false)
    }
  }

  const handleDeleteField = (fieldId: string, fieldName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Field',
      message: `Are you sure you want to delete field "${fieldName}"?`,
      onConfirm: async () => {
        try {
          await deleteFieldAction(fieldId)
        } catch (e: any) {
          alert(e.message || 'Failed to delete field')
        }
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-4xl mx-auto min-h-screen pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-neutral-900 text-white p-5 rounded-3xl shadow-lg border border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">Site Admin Panel</h1>
              <span className="text-[9px] font-extrabold uppercase tracking-widest bg-amber-500 text-black px-2 py-0.5 rounded-full">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-medium">Platform Management & System Oversight</p>
          </div>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="rounded-xl border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs">
            Dashboard
          </Button>
        </Link>
      </div>

      {/* MODULE TABS */}
      <div className="flex bg-neutral-100 p-1.5 rounded-2xl overflow-x-auto gap-1 scrollbar-none">
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'users', label: `👥 Users (${users.length})` },
          { key: 'broadcasts', label: '📢 Announcements' },
          { key: 'fields', label: `🏟️ Turf Fields (${fields.length})` },
          { key: 'groups', label: `🛡️ Groups (${groups.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW MODULE */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mb-1">
                <Users className="w-4 h-4 text-emerald-500" /> Total Users
              </div>
              <div className="text-2xl font-black text-neutral-900">{stats.totalUsers}</div>
              <div className="text-[10px] text-neutral-400 font-medium">Registered Accounts</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mb-1">
                <Shield className="w-4 h-4 text-blue-500" /> Total Groups
              </div>
              <div className="text-2xl font-black text-neutral-900">{stats.totalGroups}</div>
              <div className="text-[10px] text-neutral-400 font-medium">Active Squads</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mb-1">
                <Calendar className="w-4 h-4 text-amber-500" /> Match Bookings
              </div>
              <div className="text-2xl font-black text-neutral-900">{stats.totalBookings}</div>
              <div className="text-[10px] text-neutral-400 font-medium">Organized Sessions</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mb-1">
                <MapPin className="w-4 h-4 text-purple-500" /> Turf Fields
              </div>
              <div className="text-2xl font-black text-neutral-900">{stats.totalFields}</div>
              <div className="text-[10px] text-neutral-400 font-medium">Venues Listed</div>
            </div>
          </div>

          {/* QUICK SUMMARY */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> System Health & Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <span className="font-bold text-neutral-700">Platform Access:</span>
                <span className="ml-2 text-emerald-600 font-extrabold">Active & Healthy</span>
              </div>
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <span className="font-bold text-neutral-700">Suspended Users:</span>
                <span className="ml-2 text-rose-600 font-extrabold">{users.filter(u => u.is_suspended).length} Users</span>
              </div>
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <span className="font-bold text-neutral-700">Recent Broadcasts:</span>
                <span className="ml-2 text-amber-600 font-extrabold">{broadcasts.length} Sent</span>
              </div>
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <span className="font-bold text-neutral-700">Direct Turf Booking:</span>
                <span className="ml-2 text-sky-600 font-extrabold">Schema Ready 🚀</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. USER MANAGEMENT MODULE */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          {/* SEARCH & FILTERS */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                placeholder="Search user by name, email or @username..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <CustomSelect
              value={userPosFilter}
              onChange={setUserPosFilter}
              options={[
                { value: 'ALL', label: 'All Positions' },
                { value: 'GK', label: 'Goalkeepers (GK)' },
                { value: 'DEF', label: 'Defenders (DEF)' },
                { value: 'MID', label: 'Midfielders (MID)' },
                { value: 'ATT', label: 'Forwards (ATT)' },
              ]}
              buttonClassName="py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 font-semibold"
            />
          </div>

          {/* USERS TABLE */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider bg-neutral-50/50">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-3">Position</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-neutral-800">
                        <div className="flex items-center gap-2.5">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt={u.full_name} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {(u.full_name || 'U').charAt(0)}
                            </div>
                          )}
                          <div className="flex flex-col truncate">
                            <span className="truncate flex items-center gap-1">
                              {u.full_name}
                              {u.is_site_admin && (
                                <span className="text-[8px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.2 rounded uppercase">Admin</span>
                              )}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-normal">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-neutral-600 font-semibold">
                        {u.preferred_position || 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-neutral-500 font-medium truncate max-w-[150px]">
                        {u.email || 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {u.is_suspended ? (
                          <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Suspended
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {u.id !== currentUserId && (
                          <Button
                            size="sm"
                            variant={u.is_suspended ? 'outline' : 'destructive'}
                            className={`h-7 text-[10px] px-2.5 rounded-lg ${u.is_suspended ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                            onClick={() => setSuspensionModal({
                              isOpen: true,
                              user: u,
                              suspend: !u.is_suspended,
                              reason: ''
                            })}
                          >
                            {u.is_suspended ? 'Reinstate' : 'Suspend'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-400 text-xs italic">
                        No matching users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. SYSTEM BROADCASTS MODULE */}
      {activeTab === 'broadcasts' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* CREATE BROADCAST FORM */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-500" /> Post Platform Announcement
            </h3>

            {broadcastToast && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                {broadcastToast}
              </div>
            )}

            <form onSubmit={handleCreateBroadcast} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1 block">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Scheduled System Maintenance / New Feature Launch"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1 block">Announcement Message</label>
                <textarea
                  rows={3}
                  placeholder="Write message details... This will display as a dashboard banner popup and in user notifications."
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSendingBroadcast}
                className="w-full h-11 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl"
              >
                {isSendingBroadcast ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Megaphone className="w-4 h-4 mr-2 text-amber-400" />}
                Post Announcement to All Dashboards
              </Button>
            </form>
          </div>

          {/* SENT BROADCASTS HISTORY */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Broadcast History</h4>
            <div className="space-y-2">
              {broadcasts.map(b => (
                <div key={b.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex justify-between items-start">
                  <div>
                    <h5 className="text-xs font-bold text-neutral-900">{b.title}</h5>
                    <p className="text-xs text-neutral-600 mt-0.5">{b.message}</p>
                    <span className="text-[9px] text-neutral-400 mt-1 block">
                      Posted: {new Date(b.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
              {broadcasts.length === 0 && (
                <p className="text-xs text-neutral-400 italic text-center py-4">No broadcasts sent yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. TURF FIELDS MODULE */}
      {activeTab === 'fields' && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-500" /> Turf Fields & Venues
              </h3>
              <p className="text-[10px] text-neutral-400 font-medium">Manage Listed Venues & Direct Booking Readiness</p>
            </div>
            <Button
              size="sm"
              onClick={() => setFieldModal({ isOpen: true, field: null, name: '', google_maps_url: '' })}
              className="bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Turf Field
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.id} className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex justify-between items-start">
                <div className="min-w-0 flex-1 pr-2">
                  <h4 className="font-bold text-sm text-neutral-900 truncate">{f.name}</h4>
                  {f.google_maps_url ? (
                    <a
                      href={f.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Maps Location Link
                    </a>
                  ) : (
                    <span className="text-[10px] text-neutral-400 italic block mt-1">No map link</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFieldModal({
                      isOpen: true,
                      field: f,
                      name: f.name,
                      google_maps_url: f.google_maps_url || ''
                    })}
                    className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-lg hover:bg-neutral-100"
                    title="Edit Field"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteField(f.id, f.name)}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Delete Field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {fields.length === 0 && (
              <div className="col-span-2 py-8 text-center text-neutral-400 text-xs italic bg-white rounded-2xl border border-neutral-100">
                No turf fields added yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. GROUPS OVERSIGHT MODULE */}
      {activeTab === 'groups' && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider bg-neutral-50/50">
                    <th className="py-3 px-4">Group Name</th>
                    <th className="py-3 px-3">Invite Code</th>
                    <th className="py-3 px-3 text-center">Members</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {groups.map(g => (
                    <tr key={g.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-neutral-800">{g.name}</td>
                      <td className="py-3 px-3 text-neutral-500 font-mono text-[10px]">{g.invite_code}</td>
                      <td className="py-3 px-3 text-center font-bold text-neutral-700">
                        {g.group_members ? g.group_members.length : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/groups/${g.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg">
                            View Group <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: USER SUSPENSION REASON */}
      {suspensionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-600" />
              {suspensionModal.suspend ? 'Suspend User' : 'Reinstate User'}
            </h3>
            <p className="text-xs text-neutral-600 font-medium">
              User: <strong>{suspensionModal.user?.full_name}</strong> ({suspensionModal.user?.email})
            </p>

            {suspensionModal.suspend && (
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Reason for Suspension</label>
                <textarea
                  rows={2}
                  placeholder="Reason included in notification & email..."
                  value={suspensionModal.reason}
                  onChange={e => setSuspensionModal({ ...suspensionModal, reason: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-xs"
                onClick={() => setSuspensionModal({ isOpen: false, user: null, suspend: true, reason: '' })}
              >
                Cancel
              </Button>
              <Button
                disabled={isSuspending}
                variant={suspensionModal.suspend ? 'destructive' : 'default'}
                className="flex-1 rounded-xl text-xs font-bold"
                onClick={handleConfirmSuspension}
              >
                {isSuspending ? <Loader2 className="w-4 h-4 animate-spin" /> : suspensionModal.suspend ? 'Confirm Suspend' : 'Confirm Reinstate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / ADD TURF FIELD */}
      {fieldModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              {fieldModal.field ? 'Edit Turf Field' : 'Add New Turf Field'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Field / Venue Name</label>
                <input
                  type="text"
                  placeholder="e.g. Goal Arena Uttara"
                  value={fieldModal.name}
                  onChange={e => setFieldModal({ ...fieldModal, name: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Google Maps URL</label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={fieldModal.google_maps_url}
                  onChange={e => setFieldModal({ ...fieldModal, google_maps_url: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-xs"
                onClick={() => setFieldModal({ isOpen: false, field: null, name: '', google_maps_url: '' })}
              >
                Cancel
              </Button>
              <Button
                disabled={isSavingField}
                className="flex-1 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold"
                onClick={handleSaveField}
              >
                {isSavingField ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Field'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  )
}
