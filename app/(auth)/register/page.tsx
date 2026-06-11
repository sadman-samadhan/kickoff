/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client"

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Upload } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const POSITIONS = ['GK', 'DEF', 'MID', 'ATT']
const MAX_AVATAR_SIZE = 300

function compressImage(file: File, maxSize = MAX_AVATAR_SIZE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Scale down to fit within maxSize x maxSize
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

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    preferredPosition: '',
    secondaryPosition: '',
  })
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  // Auto-suggest username
  useEffect(() => {
    if (formData.fullName && !formData.username && !formData.email) {
      const suggested = formData.fullName.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 1000)
      setFormData(prev => ({ ...prev, username: suggested }))
    }
  }, [formData.fullName, formData.email])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, avatar: 'File size must be less than 5MB' }))
        return
      }
      setAvatar(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setErrors(prev => ({ ...prev, avatar: '' }))
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    if (!formData.password || formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (!formData.preferredPosition) newErrors.preferredPosition = 'Preferred Position is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')
    if (!validate()) return

    setIsLoading(true)

    try {
      const emailToUse = formData.email.trim()

      // 1. Create Auth User with metadata (The Database Trigger will use this to create the profile)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailToUse,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            username: formData.username,
            preferred_position: formData.preferredPosition,
            secondary_position: formData.secondaryPosition,
          }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user account')

      const userId = authData.user.id
      let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.fullName)}&background=16a34a&color=fff&size=200`

      // 2. Upload Avatar if provided
      if (avatar) {
        try {
          const compressed = await compressImage(avatar)
          const uploadFormData = new FormData()
          uploadFormData.append('file', compressed, 'avatar.jpg')

          const uploadRes = await fetch('/api/upload/avatar', {
            method: 'POST',
            body: uploadFormData
          })
          const uploadData = await uploadRes.json()
          if (uploadData.url) {
            avatarUrl = uploadData.url
          }
        } catch (uploadErr) {
          console.error("Avatar upload error:", uploadErr)
        }
      }

      // 3. Update profile via API (uses admin client)
      await fetch(`/api/players/${userId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrl })
      })

      // 4. Redirect on success
      router.push('/dashboard')
      router.refresh()

    } catch (err: any) {
      console.error(err)
      setServerError(err.message || 'An error occurred during registration.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setServerError('')
    setIsGoogleLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (authError) throw authError
    } catch (err: any) {
      setServerError(err.message || 'Failed to start Google sign-in.')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/icons/logo-removebg-preview.png" alt="Logo" className="w-40 h-40 object-contain" />
        </div>

        <Card className="border-0 shadow-xl shadow-neutral-200/50">
          <CardHeader className="space-y-2 text-center pb-6">
            <CardTitle className="text-2xl font-bold tracking-tight text-neutral-900">Join the Squad</CardTitle>
            <CardDescription className="text-neutral-500">
              Create your player profile to start booking matches
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {serverError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                  {serverError}
                </div>
              )}

              {/* Avatar Upload */}
              <div className="flex flex-col items-center justify-center space-y-3 pb-2">
                <div
                  className="w-24 h-24 rounded-full border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center bg-neutral-50 text-neutral-500 cursor-pointer overflow-hidden relative hover:bg-neutral-100 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mb-1 text-neutral-400" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Photo</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                {errors.avatar && <p className="text-xs text-red-500">{errors.avatar}</p>}
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">Full Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                  placeholder="Lionel Messi"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <label className="text-sm font-semibold text-neutral-700">Email <span className="text-red-500">*</span></label>
                  <span className="text-[10px] text-neutral-500">Used for match notifications</span>
                </div>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                  placeholder="lm10@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">@</span>
                  <input
                    type="text"
                    className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                    placeholder="lionel10"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">Password</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              {/* Positions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">Preferred Pos</label>
                  <select
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm bg-white"
                    value={formData.preferredPosition}
                    onChange={(e) => setFormData({ ...formData, preferredPosition: e.target.value, secondaryPosition: formData.secondaryPosition === e.target.value ? '' : formData.secondaryPosition })}
                  >
                    <option value="" disabled>Select...</option>
                    {POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                  {errors.preferredPosition && <p className="text-xs text-red-500 mt-1">{errors.preferredPosition}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">Secondary <span className="text-neutral-400 font-normal">(Opt)</span></label>
                  <select
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm bg-white"
                    value={formData.secondaryPosition}
                    onChange={(e) => setFormData({ ...formData, secondaryPosition: e.target.value })}
                  >
                    <option value="">None</option>
                    {POSITIONS.filter(pos => pos !== formData.preferredPosition).map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg mt-6 transition-all"
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Profile...
                  </>
                ) : (
                  'Create Profile'
                )}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-neutral-400 font-medium">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
              onClick={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-neutral-500" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mr-1">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Sign up with Google
                </>
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-neutral-100 pt-6">
            <p className="text-sm text-neutral-600">
              Already have an account?{' '}
              <Link href="/login" className="text-green-600 font-semibold hover:text-green-700 hover:underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
