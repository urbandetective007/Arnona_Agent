'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { roleFromEmail } from './useRole'
import type { RoleId } from './roles'
import { HOME_ROUTE_BY_ROLE } from './access'

// Like useRequireAuth, but also redirects away if the signed-in role isn't
// one of `allowed` — e.g. a surveyor manually navigating to /upload is sent
// back to their own home route instead of seeing the page.
export function useRequireRole(allowed: RoleId[]): boolean {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    function handle(session: Session | null) {
      if (!active) return
      if (!session) { router.replace('/login'); return }
      const role = roleFromEmail(session.user.email)
      if (!role || !allowed.includes(role)) {
        router.replace(role ? HOME_ROUTE_BY_ROLE[role] : '/login')
        return
      }
      setReady(true)
    }

    supabase.auth.getSession().then(({ data }) => handle(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => handle(session))

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  return ready
}
