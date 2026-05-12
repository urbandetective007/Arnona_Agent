const PASSWORD = 'אשכול הידע'
const AUTH_KEY = 'arnona_auth'

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AUTH_KEY) === '1'
}

export function login(password: string): boolean {
  if (password.trim() === PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, '1')
    return true
  }
  return false
}

export function logout(): void {
  sessionStorage.removeItem(AUTH_KEY)
}
