'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { InstallLink } from '@/components/PwaSetup'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Check, Eye, EyeOff, Landmark, LayoutDashboard, Lock, Route, ShieldCheck } from 'lucide-react'
import { login } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ROLES, type RoleId } from '@/lib/roles'
import { HOME_ROUTE_BY_ROLE } from '@/lib/access'
import { roleFromEmail } from '@/lib/useRole'
import { Input } from '@/components/ui'
import { LoginHero } from '@/components/LoginHero'

const LOGIN_ROLE_ORDER: RoleId[] = ['employee', 'manager', 'surveyor']

const ROLE_META: Record<RoleId, { icon: LucideIcon; description: string }> = {
  employee: { icon: ShieldCheck, description: 'גישה מלאה · העלאת דוחות, כלל הנתונים, הקצאה לסוקרים' },
  manager: { icon: LayoutDashboard, description: 'צפייה בלבד · דשבורד, מפת נכסים, פילוח שכונות ומעקב תוצאות סקר' },
  surveyor: { icon: Route, description: 'תוכנית עבודה יומית לפי שכונה + דיווח ממצאים מהשטח' },
}

// The form's parts rise into place one after another (globals.css, "Login screen").
const stagger = (i: number): CSSProperties => ({ ['--i' as string]: i })

export default function LoginPage() {
  const [roleId, setRoleId] = useState<RoleId>(ROLES[0].id)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const role = roleFromEmail(data.session?.user.email)
      if (role) router.replace(HOME_ROUTE_BY_ROLE[role])
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const email = ROLES.find(r => r.id === roleId)!.email
    const errorMessage = await login(email, password)
    setLoading(false)
    if (!errorMessage) router.push(HOME_ROUTE_BY_ROLE[roleId])
    else { setError(errorMessage); setPassword('') }
  }

  return (
    <div className="min-h-screen flex bg-surface">
      <div className="w-full lg:w-[560px] shrink-0 flex flex-col px-6 sm:px-12 lg:px-16 py-10 lg:py-14">
        <div className="max-w-sm w-full mx-auto lg:mx-0 flex flex-col flex-1">
          <div className="login-fade-up flex items-center gap-2.5" style={stagger(0)}>
            <Landmark size={28} className="text-brand shrink-0" strokeWidth={1.7} />
            <div>
              <div className="text-[16px] font-bold text-ink">ארנו-נט</div>
              <div className="text-[12px] text-subtle">עיריית ירושלים · אגף הארנונה</div>
            </div>
          </div>

          <div className="login-fade-up mt-12" style={stagger(1)}>
            <h1 className="text-[27px] font-bold text-ink tracking-tight">כניסה למערכת</h1>
            <p className="text-[13.5px] text-subtle mt-2 leading-relaxed">בחר את סוג המשתמש שלך — כל תפקיד מקבל מסכים וכלים משלו.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col flex-1">
            <div role="radiogroup" aria-label="סוג משתמש" className="flex flex-col gap-2.5">
              {LOGIN_ROLE_ORDER.map((id, i) => {
                const r = ROLES.find(role => role.id === id)!
                const meta = ROLE_META[id]
                const Icon = meta.icon
                const active = roleId === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { setRoleId(id); setError(null) }}
                    style={stagger(2 + i)}
                    className={`login-fade-up login-role text-start flex items-center gap-3.5 rounded-xl px-4 py-3.5 border-[1.5px] transition-colors ${
                      active ? 'border-brand bg-brand/[0.04]' : 'border-hairline hover:border-[#c7d1de]'
                    }`}
                  >
                    <span className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 ${active ? 'bg-brand' : 'bg-canvas'}`}>
                      <Icon size={18} className={active ? 'text-white' : 'text-charcoal'} strokeWidth={1.8} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-ink">{r.label}</div>
                      <div className="text-[12px] text-subtle mt-0.5 leading-snug">{meta.description}</div>
                    </div>
                    <span className={`w-[19px] h-[19px] rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-brand' : 'border-[1.5px] border-hairline'}`}>
                      {active && <Check size={11} className="pop-in text-white" strokeWidth={3.4} />}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="login-fade-up mt-6" style={stagger(5)}>
              <label className="block text-[13px] font-semibold text-charcoal mb-1.5">סיסמה</label>
              <div className="relative">
                <Lock size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-subtle pointer-events-none" strokeWidth={1.9} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  placeholder="הכנס סיסמה"
                  autoFocus
                  className={`w-full h-12 ps-10 pe-10 text-[15px] ${error ? 'border-high focus:border-high' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute top-1/2 -translate-y-1/2 end-3.5 text-subtle hover:text-charcoal"
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
                </button>
              </div>
              {error && <p className="text-[12.5px] text-high font-semibold mt-2">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={stagger(6)}
              className="login-fade-up login-submit mt-5 h-[50px] rounded-xl bg-brand text-white text-[15px] font-semibold shadow-[0_4px_14px_rgba(2,74,216,0.28)] hover:bg-brand-deep transition-colors disabled:opacity-60"
            >
              {loading ? 'מתחבר...' : 'כניסה למערכת'}
            </button>

            <div className="login-fade-up mt-auto pt-8 flex items-center gap-2" style={stagger(7)}>
              <Lock size={13} className="text-subtle shrink-0" strokeWidth={1.9} />
              <span className="text-[11.5px] text-subtle">חיבור מאובטח ומוצפן</span>
              <InstallLink className="ms-auto text-[12px] font-semibold text-brand" />
            </div>
          </form>
        </div>
      </div>

      <LoginHero />
    </div>
  )
}
