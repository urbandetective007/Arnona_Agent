'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { ROLES, type RoleId } from './roles'

export function roleFromEmail(email: string | null | undefined): RoleId | null {
  if (!email) return null
  return ROLES.find(r => r.email === email)?.id ?? null
}

// Derives the current user's role from their (internal) Supabase Auth email —
// each of the 3 accounts already maps 1:1 to a role via ROLES, so no extra
// profiles table is needed.
export function useRole(): RoleId | null {
  const [role, setRole] = useState<RoleId | null>(null)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setRole(roleFromEmail(data.session?.user.email))
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setRole(roleFromEmail(session?.user.email))
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return role
}
