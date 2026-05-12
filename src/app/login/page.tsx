'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, isAuthenticated } from '@/lib/auth'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
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
      setShake(true)
      setPassword('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
      <div className={`bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm transition-all ${shake ? 'animate-bounce' : ''}`}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏛️</div>
          <h1 className="text-xl font-bold text-gray-900">סוכן ארנונה</h1>
          <p className="text-sm text-gray-500 mt-1">עיריית ירושלים</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false) }}
              placeholder="הכנס סיסמה..."
              autoFocus
              className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                error ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {error && <p className="text-red-500 text-xs mt-1">סיסמה שגויה, נסה שנית</p>}
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            כניסה
          </button>
        </form>
      </div>
    </div>
  )
}
