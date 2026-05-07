"use client"

import { createContext, useContext, ReactNode } from 'react'

interface Profile {
  id: string
  full_name: string
  username: string
  email: string
  avatar_url: string | null
  preferred_position: string | null
  secondary_position: string | null
}

interface ProfileContextType {
  profile: Profile | null
}

const ProfileContext = createContext<ProfileContextType>({ profile: null })

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within Providers')
  return ctx
}

export function Providers({ children, profile }: { children: ReactNode; profile: Profile | null }) {
  return (
    <ProfileContext.Provider value={{ profile }}>
      {children}
    </ProfileContext.Provider>
  )
}
