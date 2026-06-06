/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, ArrowLeft, HelpCircle, Key } from 'lucide-react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1) // 1 = Email, 2 = Security Question & New Password, 3 = Success
  const [email, setEmail] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Step 1: Submit email to retrieve security question
  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    setIsLoading(true)

    try {
      let lookupEmail = email.trim()

      // If username is provided, lookup email first
      if (!lookupEmail.includes('@')) {
        const res = await fetch('/api/auth/lookup-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: lookupEmail })
        })
        const data = await res.json()
        if (data.error || !data.email) {
          throw new Error('User not found with this username')
        }
        lookupEmail = data.email
        setEmail(lookupEmail)
      }

      const res = await fetch(`/api/auth/security-question?email=${encodeURIComponent(lookupEmail)}`)
      const data = await res.json()

      if (res.status !== 200 || data.error) {
        throw new Error(data.error || 'Failed to fetch security question')
      }

      setSecurityQuestion(data.question)
      setStep(2)
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Submit answer and new password to recover account
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!securityAnswer.trim()) {
      setError('Please provide an answer to the security question')
      return
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/security-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          answer: securityAnswer.trim(),
          newPassword
        })
      })

      const data = await res.json()

      if (res.status !== 200 || data.error) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setStep(3)
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.')
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
            <CardTitle className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center justify-center gap-2">
              <Key className="w-6 h-6 text-green-600" />
              Reset Password
            </CardTitle>
            <CardDescription className="text-neutral-500">
              {step === 1 && 'Enter your email or username to retrieve your security question'}
              {step === 2 && 'Answer the security question below to set a new password'}
              {step === 3 && 'Your password has been successfully updated'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleFetchQuestion} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">Email or Username</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                    placeholder="lionel10 or lm10@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg mt-4 transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrieving Question...
                    </>
                  ) : (
                    'Next'
                  )}
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl mb-2">
                  <div className="flex gap-2 text-neutral-800 font-semibold text-sm">
                    <HelpCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span>{securityQuestion}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">Your Answer</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                    placeholder="Type your answer here..."
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">New Password</label>
                  <input
                    type="password"
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg mt-4 transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </form>
            )}

            {step === 3 && (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <p className="text-neutral-600 text-sm font-medium">
                  Your password has been changed successfully. You can now use your new password to sign in.
                </p>
                <Link href="/login" className="block w-full">
                  <Button className="w-full bg-neutral-900 hover:bg-black text-white font-semibold py-2.5 rounded-lg transition-all">
                    Go to Login
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>

          {step < 3 && (
            <CardFooter className="flex justify-center border-t border-neutral-100 pt-6">
              <Link href="/login" className="text-sm text-neutral-600 hover:text-neutral-800 font-semibold flex items-center gap-1.5 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}
