/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Goal, Target, Shield, Activity, Camera, ChevronDown, ChevronUp, Loader2, X, Edit3, Settings, Trophy, LogOut, BellOff, Bell, KeyRound, Eye, EyeOff, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Toast } from '@/components/ui/Toast'
import StatShareCard from '@/components/cards/StatShareCard'

const MAX_AVATAR_SIZE = 300

function compressImage(file: File, maxSize = MAX_AVATAR_SIZE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
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

  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false)
  const [securityForm, setSecurityForm] = useState({
    security_question: profile.security_question || '',
    security_answer: profile.security_answer || ''
  })

  useEffect(() => {
    setEditForm({
      preferred_position: profile.preferred_position || '',
      secondary_position: profile.secondary_position || '',
      email: profile.email || ''
    })
    setSecurityForm({
      security_question: profile.security_question || '',
      security_answer: profile.security_answer || ''
    })
  }, [profile])

  const [isSaving, setIsSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [verificationMethod, setVerificationMethod] = useState<'password' | 'question'>('password')
  const [oldPassword, setOldPassword] = useState('')
  const [securityAnswerInput, setSecurityAnswerInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (profile.security_question) {
      setVerificationMethod('question')
    } else {
      setVerificationMethod('password')
    }
  }, [profile.security_question])

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

  const resetPasswordStates = () => {
    setIsChangePasswordOpen(false)
    setIsVerified(false)
    setVerificationMethod(profile.security_question ? 'question' : 'password')
    setOldPassword('')
    setSecurityAnswerInput('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSuccess(false)
    setShowOldPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setIsUpdatingPassword(true)

    try {
      if (verificationMethod === 'question') {
        const expected = profile.security_answer?.trim().toLowerCase()
        const actual = securityAnswerInput.trim().toLowerCase()
        if (!expected) {
          throw new Error('Security question answer is not set in your profile. Please use your old password to verify.')
        }
        if (expected !== actual) {
          throw new Error('Incorrect answer to security question.')
        }
        setIsVerified(true)
      } else {
        if (!profile.email) {
          throw new Error('No email associated with this profile. Please set one first or use the security question.')
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password: oldPassword
        })
        if (error) {
          throw new Error(error.message || 'Incorrect old password.')
        }
        setIsVerified(true)
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Verification failed')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isVerified) {
      setPasswordError('Please verify your identity first.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      return
    }

    setIsUpdatingPassword(true)
    setPasswordError('')

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        throw error
      }
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 max-w-xl mx-auto min-h-screen pb-24">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* 1. PROFILE HEADER CARD */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

        <div className="relative mb-4">
          {profile.avatar_url ? (
            <div className="w-24 h-24 rounded-full shadow-md border-4 border-white z-10 relative overflow-hidden bg-white">
              <Image src={profile.avatar_url} alt="Avatar" fill sizes="96px" className="object-cover" />
            </div>
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

            {/* Share Stats Button */}
            <StatShareCard
              playerName={profile.full_name}
              position={profile.preferred_position}
              avatarUrl={profile.avatar_url}
              goals={stats.goals}
              assists={stats.assists}
              cleanSheets={stats.clean_sheets}
              matchesPlayed={stats.matches_played}
            />
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

        {/* Change Password Option */}
        <div className="flex items-center justify-between py-3 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-neutral-600" />
            <div>
              <p className="text-sm font-bold text-neutral-800">Change Password</p>
              <p className="text-[11px] text-neutral-400">Update your account password</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChangePasswordOpen(true)}
            className="rounded-xl border-neutral-200"
          >
            Update
          </Button>
        </div>

        {/* Security Question Option */}
        <div className="flex items-center justify-between py-3 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-neutral-600" />
            <div>
              <p className="text-sm font-bold text-neutral-800">Security Question</p>
              <p className="text-[11px] text-neutral-400">Manage your password recovery question</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSecurityModalOpen(true)}
            className="rounded-xl border-neutral-200"
          >
            Update
          </Button>
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

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 pb-4 shrink-0">
              <h3 className="font-bold text-lg text-neutral-900">Edit Profile</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 pt-0 overflow-y-auto flex-1 space-y-4">
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

              {/* Security Question removed from profile info edit */}

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

      {/* CHANGE PASSWORD MODAL */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 pb-4 shrink-0">
              <h3 className="font-bold text-lg text-neutral-900">Change Password</h3>
              <button onClick={resetPasswordStates} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 pt-0 overflow-y-auto flex-1 space-y-4">
              {passwordSuccess ? (
                <div className="flex flex-col items-center text-center space-y-4 py-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-neutral-900 mb-1">Password Updated</h4>
                    <p className="text-sm text-neutral-500">Your password has been changed successfully.</p>
                  </div>
                  <Button onClick={resetPasswordStates} className="w-full bg-neutral-900 hover:bg-black text-white rounded-xl">
                    Close
                  </Button>
                </div>
              ) : !isVerified ? (
                <form onSubmit={handleVerifyIdentity} className="space-y-4">
                  <h4 className="text-sm font-bold text-neutral-800 mb-2">Step 1: Verify Identity</h4>
                  
                  {passwordError && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                      {passwordError}
                    </div>
                  )}

                  {profile.security_question && (
                    <div className="flex bg-neutral-100 rounded-xl p-1 text-xs font-semibold mb-4">
                      <button
                        type="button"
                        onClick={() => { setVerificationMethod('question'); setPasswordError(''); }}
                        className={`flex-1 py-1.5 rounded-lg transition-all ${verificationMethod === 'question' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500'}`}
                      >
                        Security Question
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVerificationMethod('password'); setPasswordError(''); }}
                        className={`flex-1 py-1.5 rounded-lg transition-all ${verificationMethod === 'password' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500'}`}
                      >
                        Old Password
                      </button>
                    </div>
                  )}

                  {verificationMethod === 'question' ? (
                    <div className="space-y-3">
                      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Your Question</span>
                        <p className="text-sm font-semibold text-neutral-800">{profile.security_question}</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Answer</label>
                        <input
                          type="text"
                          required
                          className="w-full px-3 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                          value={securityAnswerInput}
                          onChange={e => setSecurityAnswerInput(e.target.value)}
                          placeholder="Your answer"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Old Password</label>
                      <div className="relative">
                        <input
                          type={showOldPassword ? "text" : "password"}
                          required
                          className="w-full pl-3 pr-10 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                          value={oldPassword}
                          onChange={e => setOldPassword(e.target.value)}
                          placeholder="Enter your current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                        >
                          {showOldPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="w-full h-12 bg-neutral-900 hover:bg-black text-white rounded-xl shadow-sm mt-4 text-base"
                  >
                    {isUpdatingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <h4 className="text-sm font-bold text-neutral-800 mb-2">Step 2: Enter New Password</h4>

                  {passwordError && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                      {passwordError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-500 uppercase">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        minLength={6}
                        className="w-full pl-3 pr-10 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                      >
                        {showNewPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        minLength={6}
                        className="w-full pl-3 pr-10 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm mt-4 text-base"
                  >
                    {isUpdatingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECURITY QUESTION MODAL */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 pb-4 shrink-0">
              <h3 className="font-bold text-lg text-neutral-900">Security Question</h3>
              <button onClick={() => setIsSecurityModalOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 pt-0 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Security Question</label>
                <select
                  className="w-full px-3 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                  value={securityForm.security_question}
                  onChange={e => setSecurityForm({ ...securityForm, security_question: e.target.value })}
                >
                  <option value="">Select a security question...</option>
                  <option value="Who is your all-time favorite football player?">Who is your all-time favorite football player?</option>
                  <option value="Which football club do you support?">Which football club do you support?</option>
                  <option value="What was the first football jersey you owned?">What was the first football jersey you owned?</option>
                  <option value="Who is your favorite football manager?">Who is your favorite football manager?</option>
                  <option value="In which stadium would you most love to watch a match?">In which stadium would you most love to watch a match?</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase">Security Answer</label>
                <input
                  type="text"
                  className="w-full px-3 py-3 border border-neutral-200 rounded-xl text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-green-500"
                  value={securityForm.security_answer}
                  onChange={e => setSecurityForm({ ...securityForm, security_answer: e.target.value })}
                  placeholder="Your secret answer"
                />
                <p className="text-[10px] text-neutral-400 font-medium">This will be used to verify your identity when changing your password or recovering your account.</p>
              </div>

              <Button
                onClick={async () => {
                  if (!securityForm.security_question || !securityForm.security_answer.trim()) {
                    alert('Please select a question and provide an answer.')
                    return
                  }
                  await updateProfile(securityForm)
                  setIsSecurityModalOpen(false)
                  setToastMessage('✅ Security question updated!')
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
