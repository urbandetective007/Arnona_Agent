'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, isAuthenticated } from '@/lib/auth'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) router.replace('/')
  }, [router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (login(password)) {
      router.push('/')
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--color-canvas)' }}>
      {/* Brand */}
      <div className="text-center mb-12">
        <h1 style={{ fontSize: 40, fontWeight: 400, color: 'var(--color-ink)', letterSpacing: 0 }}>
          סוכן ארנונה
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 8 }}>
          עיריית ירושלים — מערכת ניתוח נכסים
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full" style={{ maxWidth: 360 }}>
        <div className="mb-4">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
            placeholder="סיסמה"
            autoFocus
            style={{
              width: '100%',
              height: 44,
              padding: '0 16px',
              border: `1px solid ${error ? '#aa2d00' : 'var(--color-hairline)'}`,
              borderRadius: 6,
              fontSize: 14,
              color: 'var(--color-ink)',
              background: 'var(--color-canvas)',
              outline: 'none',
            }}
          />
          {error && (
            <p style={{ color: 'var(--color-sig-coral)', fontSize: 13, marginTop: 6 }}>
              סיסמה שגויה, נסה שנית
            </p>
          )}
        </div>

        <button
          type="submit"
          style={{
            width: '100%',
            height: 48,
            background: 'var(--color-ink)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          כניסה
        </button>
      </form>
    </div>
  )
}
