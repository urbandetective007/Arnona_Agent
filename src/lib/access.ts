import type { RoleId } from './roles'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Map, BarChart3, ClipboardCheck, Route, Table2, FolderOpen, Upload } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Sidebar section header this item is grouped under (AppShell only). */
  group: string
}

// Single source of truth: which routes each role may reach, and what each
// role sees in the sidebar. Employees get every route (their own plus
// manager's and surveyor's), so their list is derived below rather than
// duplicated.
const MANAGER_ROUTES: NavItem[] = [
  { href: '/', label: 'דשבורד', icon: LayoutDashboard, group: 'תמונת מצב' },
  { href: '/map', label: 'מפת נכסים', icon: Map, group: 'תמונת מצב' },
  { href: '/neighborhoods', label: 'פילוח שכונות', icon: BarChart3, group: 'תמונת מצב' },
  { href: '/survey-tracking', label: 'מעקב תוצאות סקר', icon: ClipboardCheck, group: 'תמונת מצב' },
]

const SURVEYOR_ROUTES: NavItem[] = [
  { href: '/work-plan', label: 'תוכנית עבודה', icon: Route, group: 'היום שלי' },
]

const EMPLOYEE_ONLY_ROUTES: NavItem[] = [
  { href: '/businesses', label: 'כלל הנתונים', icon: Table2, group: 'ניהול נתונים' },
  { href: '/files', label: 'קבצים שהועלו', icon: FolderOpen, group: 'ניהול נתונים' },
  { href: '/upload', label: 'העלאת דוח חדש', icon: Upload, group: 'ניהול נתונים' },
]

export const NAV_BY_ROLE: Record<RoleId, NavItem[]> = {
  manager: MANAGER_ROUTES,
  surveyor: SURVEYOR_ROUTES,
  employee: [...MANAGER_ROUTES, ...SURVEYOR_ROUTES, ...EMPLOYEE_ONLY_ROUTES],
}

export const ROUTE_ACCESS: Record<string, RoleId[]> = {
  '/': ['employee', 'manager'],
  '/map': ['employee', 'manager'],
  '/neighborhoods': ['employee', 'manager'],
  '/survey-tracking': ['employee', 'manager'],
  '/work-plan': ['employee', 'surveyor'],
  '/businesses': ['employee'],
  '/files': ['employee'],
  '/upload': ['employee'],
}

export const HOME_ROUTE_BY_ROLE: Record<RoleId, string> = {
  employee: '/',
  manager: '/',
  surveyor: '/work-plan',
}

// Short descriptor shown under the role name in the AppShell sidebar badge.
export const ROLE_DESCRIPTION_BY_ROLE: Record<RoleId, string> = {
  manager: 'תצוגת ניהול · צפייה',
  employee: 'גישה מלאה למערכת',
  surveyor: 'הנכסים שהוקצו לי',
}
