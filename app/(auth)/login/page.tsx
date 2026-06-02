/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    identifier: '', // Email or username
    password: '',
    keepSignedIn: true,
  })

  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.identifier.trim() || !formData.password) {
      setError('Please enter your username/email and password')
      return
    }

    setIsLoading(true)

    try {
      let emailToLogin = formData.identifier.trim()

      // If it doesn't look like an email, treat as username
      if (!emailToLogin.includes('@')) {
        const res = await fetch('/api/auth/lookup-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: emailToLogin })
        })

        const data = await res.json()
        if (data.error || !data.email) {
          throw new Error('Incorrect username/email or password')
        }

        emailToLogin = data.email
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password: formData.password,
      })

      if (authError) {
        throw new Error('Incorrect username/email or password')
      }

      router.push('/dashboard')
      router.refresh()

    } catch (err: any) {
      setError(err.message || 'An error occurred during login.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/icons/logo-removebg-preview.png" alt="Logo" width={160} height={160} className="object-contain" priority />
        </div>

        <Card className="border-0 shadow-xl shadow-neutral-200/50">
          <CardHeader className="space-y-2 text-center pb-6">
            <CardTitle className="text-2xl font-bold tracking-tight text-neutral-900">Welcome Back</CardTitle>
            <CardDescription className="text-neutral-500">
              Sign in to manage your matches and squad
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm text-center">
                  {error}
                </div>
              )}

              {/* Identifier (Email/Username) */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">Email or Username</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                  placeholder="lionel10 or lm10@example.com"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                />
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
              </div>

              {/* Keep Signed In */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="keepSignedIn"
                  checked={formData.keepSignedIn}
                  onChange={(e) => setFormData({ ...formData, keepSignedIn: e.target.checked })}
                  className="h-4 w-4 rounded border-neutral-300 text-green-600 focus:ring-green-500 cursor-pointer accent-green-600"
                />
                <label htmlFor="keepSignedIn" className="text-sm text-neutral-600 cursor-pointer">
                  Keep me signed in
                </label>
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg mt-6 transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-neutral-100 pt-6">
            <p className="text-sm text-neutral-600">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-green-600 font-semibold hover:text-green-700 hover:underline">
                Register here
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
