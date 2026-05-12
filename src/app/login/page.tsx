'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, isAuthenticated } from '@/lib/auth'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(false)
  const router = useRouter()

  useEffect(() => { if (isAuthenticated()) router.replace('/') }, [router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (login(password)) router.push('/')
    else { setError(true); setPassword('') }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

      {/* Cloud band top strip */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 6, background: 'var(--hp-blue)' }} />

      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        {/* Brand */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, letterSpacing: -0.5 }}>סוכן ארנונה</p>
          <p style={{ color: 'var(--graphite)', fontSize: 14, marginTop: 8 }}>עיריית ירושלים</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
              סיסמה
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              placeholder="הכנס סיסמה"
              autoFocus
              style={{
                width: '100%', height: 44, padding: '0 14px',
                border: `1px solid ${error ? 'var(--coral)' : 'var(--steel)'}`,
                borderRadius: 4, fontSize: 16, color: 'var(--ink)',
                background: 'var(--canvas)', outline: 'none',
              }}
            />
            {error && <p style={{ color: 'var(--coral)', fontSize: 13, marginTop: 6 }}>סיסמה שגויה — נסה שנית</p>}
          </div>

          <button type="submit" style={btnPrimary}>כניסה למערכת</button>
        </form>
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  width: '100%', height: 44,
  background: 'var(--hp-blue)', color: 'var(--on-ink)',
  border: 'none', borderRadius: 4, cursor: 'pointer',
  fontSize: 14, fontWeight: 600,
  letterSpacing: '0.7px', textTransform: 'uppercase',
}
