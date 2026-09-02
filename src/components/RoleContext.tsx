'use client'

import { createContext, useContext } from 'react'
import { useRole } from '@/lib/useRole'
import type { RoleId } from '@/lib/roles'

const RoleContext = createContext<RoleId | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const role = useRole()
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRoleContext(): RoleId | null {
  return useContext(RoleContext)
}
