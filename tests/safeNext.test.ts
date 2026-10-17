import { describe, expect, it } from 'vitest'
import { safeNext, withNext } from '@/lib/safeNext'

describe('safeNext (where to go after signing in)', () => {
  it('keeps paths inside the app', () => {
    expect(safeNext('/join/0a658b6d')).toBe('/join/0a658b6d')
    expect(safeNext('%2Fgroups%2Fabc%3Ftab%3Dchat')).toBe('/groups/abc?tab=chat')
  })

  it('refuses anything that could leave the site', () => {
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', '@evil.com', 'evil.com', '%2F%2Fevil.com', '/\u0000x', 'javascript:alert(1)']) {
      expect(safeNext(bad)).toBe('/dashboard')
    }
  })

  it('never loops back to the sign-in pages', () => {
    expect(safeNext('/login?next=/x')).toBe('/dashboard')
    expect(safeNext('/register')).toBe('/dashboard')
    expect(safeNext(null)).toBe('/dashboard')
  })

  it('builds sign-in links that come back', () => {
    expect(withNext('/login', '/join/abc12345')).toBe('/login?next=%2Fjoin%2Fabc12345')
    expect(withNext('/register', '//evil.com')).toBe('/register')
    expect(withNext('/login', null)).toBe('/login')
  })
})
