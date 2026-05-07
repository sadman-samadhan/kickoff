/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Goal, Target, Shield, Activity, Camera, ChevronDown, ChevronUp, Loader2, X, Edit3, Settings, Trophy, LogOut, BellOff, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Toast } from '@/components/ui/Toast'

const MAX_AVATAR_SIZE = 300

function compressImage(file: File, maxSize = MAX_AVATAR_SIZE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to compress image'))
        },
        'image/jpeg',
        0.8
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function ProfileClient({ initialProfile, userId }: { initialProfile: any, userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState(initialProfile)
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState(profile.full_name)

  const [editForm, setEditForm] = useState({
    preferred_position: profile.preferred_position || '',
    secondary_position: profile.secondary_position || '',
    email: profile.email || ''
  })

  const [isSaving, setIsSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/stats/player/${userId}`)
        const data = await res.json()
        setStats(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingStats(false)
      }
    }
    fetchStats()
  }, [userId])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]

    try {
      const compressed = await compressImage(file)
      
      const formData = new FormData()
      formData.append('file', compressed, 'avatar.jpg')

      const res = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      await updateProfile({ avatar_url: data.url })
      setToastMessage('✅ Avatar updated!')
    } catch (err: any) {
      console.error('Avatar upload error:', err)
      setToastMessage(`❌ Error: ${err.message || 'Upload failed'}`)
    }
  }

  const updateProfile = async (updates: any) => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/players/${userId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const data = await res.json()
      if (data.profile) {
        setProfile(data.profile)
      }
      setIsEditModalOpen(false)
      setIsEditingName(false)
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const saveInlineName = () => {
    if (tempName !== profile.full_name) {
      updateProfile({ full_name: tempName })
    } else {
      setIsEditingName(false)
    }
  }

  const toggleEmailNotifications = async () => {
    const newVal = !profile.email_notifications
    await updateProfile({ email_notifications: newVal })
    setToastMessage(newVal ? '🔔 Email notifications enabled' : '🔕 Email notifications disabled')
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 max-w-xl mx-auto min-h-screen pb-24">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* 1. PROFILE HEADER CARD */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

        <div className="relative mb-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover shadow-md border-4 border-white z-10 relative" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-4xl shadow-md border-4 border-white z-10 relative">
              {profile.full_name?.charAt(0)}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 bg-neutral-900 text-white p-2 rounded-full shadow-lg hover:scale-105 transition-transform z-20"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            className="hidden"
          />
        </div>

        <div className="w-full flex justify-center items-center relative z-10 mb-1">
          {isEditingName ? (
            <input
              autoFocus
              className="text-2xl font-black text-center text-neutral-900 bg-neutral-100 rounded-lg px-3 py-1 outline-none ring-2 ring-green-500 w-full max-w-[200px]"
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onBlur={saveInlineName}
              onKeyDown={e => e.key === 'Enter' && saveInlineName()}
            />
          ) : (
            <h1
              className="text-2xl font-black text-neutral-900 cursor-pointer flex items-center gap-2 hover:opacity-70 transition-opacity"
              onClick={() => setIsEditingName(true)}
            >
              {profile.full_name} <Edit3 className="w-4 h-4 text-neutral-300" />
            </h1>
          )}
        </div>

        <div className="text-neutral-500 font-medium mb-5">@{profile.username}</div>

        <Button
          variant="outline"
          onClick={() => setIsEditModalOpen(true)}
          className="rounded-full shadow-sm w-full max-w-[200px] border-neutral-200 z-10 relative"
        >
          <Settings className="w-4 h-4 mr-2" /> Edit Profile
        </Button>
      </div>

      {/* 2. PERSONAL STATS CARD */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-100">
        <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-neutral-400" /> My Stats
        </h2>

        {loadingStats ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-neutral-300" /></div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-amber-600 mb-1">{stats.goals}</span>
                <span className="text-[10px] font-bold text-amber-700/60 uppercase tracking-wider flex items-center gap-1.5"><Goal className="w-3 h-3" /> Goals</span>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-blue-600 mb-1">{stats.assists}</span>
                <span className="text-[10px] font-bold text-blue-700/60 uppercase tracking-wider flex items-center gap-1.5"><Target className="w-3 h-3" /> Assists</span>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-purple-600 mb-1">{stats.clean_sheets}</span>
                <span className="text-[10px] font-bold text-purple-700/60 uppercase tracking-wider flex items-center gap-1.5"><Shield className="w-3 h-3" /> Clean Sheets</span>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-neutral-700 mb-1">{stats.matches_played}</span>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Matches Played</span>
              </div>
            </div>
            <p className="text-[10px] text-center text-neutral-400 font-bold uppercase tracking-wider">Across all groups</p>
          </>
        ) : (
          <div className="text-center text-sm text-neutral-400 py-4">No stats available</div>
        )}
      </div>

      {/* 3. STATS BY GROUP */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-100">
        <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-neutral-400" /> Stats by Group
        </h2>

        {loadingStats ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-neutral-300" /></div>
        ) : stats?.groups && stats.groups.length > 0 ? (
          <div className="flex flex-col gap-2">
            {stats.groups.map((g: any) => {
              const isExpanded = expandedGroups[g.group_id]
              return (
                <div key={g.group_id} className="border border-neutral-200 rounded-2xl overflow-hidden transition-colors bg-white">
                  <button
                    className="w-full p-4 flex justify-between items-center bg-white hover:bg-neutral-50 transition-colors"
                    onClick={() => toggleGroup(g.group_id)}
                  >
                    <span className="font-bold text-neutral-800 text-sm">{g.group_name}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                  </button>

                  {isExpanded && (
                    <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <div className="text-lg font-black text-amber-600">{g.goals}</div>
                          <div className="text-[9px] font-bold text-neutral-400 uppercase">Goals</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-blue-600">{g.assists}</div>
                          <div className="text-[9px] font-bold text-neutral-400 uppercase">Assists</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-purple-600">{g.clean_sheets}</div>
                          <div className="text-[9px] font-bold text-neutral-400 uppercase">Clean<br />Sheets</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-neutral-700">{g.matches_played}</div>
                          <div className="text-[9px] font-bold text-neutral-400 uppercase">Matches</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-sm text-neutral-400 py-4">No group stats recorded yet.</div>
        )}
      </div>

      {/* 4. PREFERENCES CARD */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-100">
        <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-neutral-400" /> Preferences
        </h2>

        <div className="flex items-center justify-between py-3 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            {profile.email_notifications !== false ? (
              <Bell className="w-5 h-5 text-green-600" />
            ) : (
              <BellOff className="w-5 h-5 text-neutral-400" />
            )}
            <div>
              <p className="text-sm font-bold text-neutral-800">Email Notifications</p>
              <p className="text-[11px] text-neutral-400">Receive match alerts via email</p>
            </div>
          </div>
          <button
            onClick={toggleEmailNotifications}
            className={`relative w-11 h-6 rounded-full transition-colors ${profile.email_notifications !== false ? 'bg-green-500' : 'bg-neutral-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${profile.email_notifications !== false ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-red-600 bg-red-50 border border-red-100 font-bold text-sm hover:bg-red-100 active:scale-95 transition-all"
        >
          {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>

      {/* EDIT PROFILE BOTTOM SHEET */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/60 p-4 pb-0 sm:pb-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-neutral-900">Edit Profile</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Preferred Position</label>
                <select
                  className="w-full px-3 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                  value={editForm.preferred_position}
                  onChange={e => setEditForm({ ...editForm, preferred_position: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="GK">Goalkeeper (GK)</option>
                  <option value="DEF">Defender (DEF)</option>
                  <option value="MID">Midfielder (MID)</option>
                  <option value="ATT">Attacker (ATT)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Secondary Position</label>
                <select
                  className="w-full px-3 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                  value={editForm.secondary_position}
                  onChange={e => setEditForm({ ...editForm, secondary_position: e.target.value })}
                >
                  <option value="">None</option>
                  <option value="GK">Goalkeeper (GK)</option>
                  <option value="DEF">Defender (DEF)</option>
                  <option value="MID">Midfielder (MID)</option>
                  <option value="ATT">Attacker (ATT)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Email Address</label>
                <input
                  type="email"
                  className="w-full px-3 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="name@example.com"
                />
                <p className="text-[10px] text-neutral-400 font-medium">Used for match notifications.</p>
              </div>

              <Button
                onClick={() => {
                  updateProfile(editForm)
                  setToastMessage('✅ Profile updated!')
                }}
                disabled={isSaving}
                className="w-full h-12 bg-neutral-900 hover:bg-black text-white rounded-xl shadow-sm mt-4 text-base"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
