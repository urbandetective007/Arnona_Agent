import type { RoleId } from './roles'

export interface NavItem {
  href: string
  label: string
}

// Single source of truth: which routes each role may reach, and what each
// role sees in the sidebar. Employees get every route (their own plus
// manager's and surveyor's), so their list is derived below rather than
// duplicated.
const MANAGER_ROUTES: NavItem[] = [
  { href: '/', label: 'דשבורד' },
  { href: '/map', label: 'מפת נכסים' },
  { href: '/neighborhoods', label: 'פילוח שכונות' },
  { href: '/survey-tracking', label: 'מעקב תוצאות סקר' },
]

const SURVEYOR_ROUTES: NavItem[] = [
  { href: '/work-plan', label: 'תוכנית עבודה' },
]

const EMPLOYEE_ONLY_ROUTES: NavItem[] = [
  { href: '/businesses', label: 'כלל הנתונים' },
  { href: '/files', label: 'קבצים שהועלו' },
  { href: '/upload', label: 'העלאת דוח חדש' },
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
