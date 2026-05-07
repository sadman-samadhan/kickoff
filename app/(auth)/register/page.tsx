"use client"

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Upload, Trophy, Image as ImageIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const POSITIONS = ['GK', 'DEF', 'MID', 'ATT']

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
    if (!formData.password || formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (!formData.preferredPosition) newErrors.preferredPosition = 'Preferred Position is required'
    if (!formData.email && !formData.username) {
      newErrors.username = 'Username is required if no email is provided'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')
    if (!validate()) return

    setIsLoading(true)

    try {
      const emailToUse = formData.email || `${formData.username}@kickoff.local`

      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailToUse,
        password: formData.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user account')

      const userId = authData.user.id

      // 2. Upload Avatar if exists
      let avatarUrl = null
      if (avatar) {
        const fileExt = avatar.name.split('.').pop()
        const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatar)

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName)
          avatarUrl = publicUrlData.publicUrl
        } else {
          console.error("Avatar upload error:", uploadError)
          // Continue anyway, avatar is optional
        }
      }

      // 3. Insert Profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        full_name: formData.fullName,
        email: formData.email || null,
        username: formData.username || null,
        preferred_position: formData.preferredPosition,
        secondary_position: formData.secondaryPosition || null,
        avatar_url: avatarUrl,
      })

      if (profileError) {
        // If profile creation fails, we might have a dangling auth user. 
        // In a production app, we might want to handle this better (e.g. edge function).
        throw profileError
      }

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

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-green-600 p-4 rounded-full shadow-lg shadow-green-600/20">
            <Trophy className="w-8 h-8 text-white" />
          </div>
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
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <label className="text-sm font-semibold text-neutral-700">Email <span className="text-neutral-400 font-normal">(Optional)</span></label>
                  <span className="text-[10px] text-neutral-500">Used for match notifications</span>
                </div>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                  placeholder="lm10@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">
                  Username {!formData.email && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">@</span>
                  <input
                    type="text"
                    className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                    placeholder="lionel10"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, preferredPosition: e.target.value, secondaryPosition: formData.secondaryPosition === e.target.value ? '' : formData.secondaryPosition})}
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
                    onChange={(e) => setFormData({...formData, secondaryPosition: e.target.value})}
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
                disabled={isLoading}
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
