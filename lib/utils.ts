import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Public site URL for links in emails, pushes and share cards. */
export function appUrl(path = ''): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://khelahbe.vercel.app').replace(/\/$/, '')
  return base + path
}
