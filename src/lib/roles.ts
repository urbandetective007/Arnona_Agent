export type RoleId = 'employee' | 'surveyor' | 'manager'

export interface RoleOption {
  id: RoleId
  label: string
  email: string
}

// Each role logs in with its own password, but under the hood is still a real
// Supabase Auth account (email is an internal identifier, never shown to the user).
export const ROLES: RoleOption[] = [
  { id: 'employee', label: 'עובד עירייה', email: 'employee@arnona-agent.internal' },
  { id: 'surveyor', label: 'סוקר שטח', email: 'surveyor@arnona-agent.internal' },
  { id: 'manager', label: 'מנהל אגף', email: 'manager@arnona-agent.internal' },
]
