'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Check, Eye, EyeOff, Landmark, LayoutDashboard, Lock, Route, ShieldCheck } from 'lucide-react'
import { login } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ROLES, type RoleId } from '@/lib/roles'
import { HOME_ROUTE_BY_ROLE } from '@/lib/access'
import { roleFromEmail } from '@/lib/useRole'
import { Input } from '@/components/ui'

const LOGIN_ROLE_ORDER: RoleId[] = ['employee', 'manager', 'surveyor']

const ROLE_META: Record<RoleId, { icon: LucideIcon; description: string }> = {
  employee: { icon: ShieldCheck, description: 'גישה מלאה · העלאת דוחות, כלל הנתונים, הקצאה לסוקרים' },
  manager: { icon: LayoutDashboard, description: 'צפייה בלבד · דשבורד, מפת נכסים, פילוח שכונות ומעקב תוצאות סקר' },
  surveyor: { icon: Route, description: 'תוכנית עבודה יומית לפי שכונה + דיווח ממצאים מהשטח' },
}

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
          <div className="flex items-center gap-2.5">
            <Landmark size={28} className="text-brand shrink-0" strokeWidth={1.7} />
            <div>
              <div className="text-[16px] font-bold text-ink">ארנו-נט</div>
              <div className="text-[12px] text-subtle">עיריית ירושלים · אגף הארנונה</div>
            </div>
          </div>

          <div className="mt-12">
            <h1 className="text-[27px] font-bold text-ink tracking-tight">כניסה למערכת</h1>
            <p className="text-[13.5px] text-subtle mt-2 leading-relaxed">בחר את סוג המשתמש שלך — כל תפקיד מקבל מסכים וכלים משלו.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col flex-1">
            <div role="radiogroup" aria-label="סוג משתמש" className="flex flex-col gap-2.5">
              {LOGIN_ROLE_ORDER.map(id => {
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
                    className={`text-start flex items-center gap-3.5 rounded-xl px-4 py-3.5 border-[1.5px] transition-colors ${
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
                      {active && <Check size={11} className="text-white" strokeWidth={3.4} />}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-6">
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
              className="mt-5 h-[50px] rounded-xl bg-brand text-white text-[15px] font-semibold shadow-[0_4px_14px_rgba(2,74,216,0.28)] hover:bg-brand-deep transition-colors disabled:opacity-60"
            >
              {loading ? 'מתחבר...' : 'כניסה למערכת'}
            </button>

            <div className="mt-auto pt-8 flex items-center gap-2">
              <Lock size={13} className="text-subtle shrink-0" strokeWidth={1.9} />
              <span className="text-[11.5px] text-subtle">חיבור מאובטח ומוצפן</span>
            </div>
          </form>
        </div>
      </div>

      <div
        className="hidden lg:flex flex-1 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d1b2e 0%, #062b6e 55%, #024ad8 130%)' }}
      >
        <svg viewBox="0 0 820 900" className="absolute inset-0 w-full h-full opacity-50" preserveAspectRatio="xMidYMid slice">
          <g stroke="#4d7fd6" strokeWidth="1" opacity="0.28" fill="none">
            <path d="M0 180h820M0 330h820M0 480h820M0 630h820M0 780h820" />
            <path d="M130 0v900M300 0v900M470 0v900M640 0v900" />
          </g>
          <g fill="none" stroke="#7fa8f0" strokeWidth="1.4" opacity="0.5">
            <path d="M180 250 L280 220 L330 300 L250 360Z" />
            <path d="M330 300 L470 260 L520 350 L420 420 L250 360Z" />
            <path d="M470 260 L620 290 L640 400 L520 350Z" />
            <path d="M250 360 L420 420 L400 550 L230 520Z" />
            <path d="M420 420 L520 350 L640 400 L620 560 L400 550Z" />
          </g>
          <g opacity="0.85">
            <circle cx="255" cy="290" r="5" fill="#ff6b81" />
            <circle cx="400" cy="330" r="5" fill="#ff6b81" />
            <circle cx="330" cy="255" r="4" fill="#ffb27f" />
            <circle cx="540" cy="320" r="4" fill="#ffb27f" />
            <circle cx="300" cy="470" r="4" fill="#6ee7a8" />
            <circle cx="480" cy="490" r="4" fill="#8fb6ff" />
            <circle cx="580" cy="440" r="5" fill="#ff6b81" />
          </g>
          <g opacity="0.32">
            <circle cx="255" cy="290" r="46" fill="#ff6b81" />
            <circle cx="400" cy="330" r="38" fill="#ff6b81" />
            <circle cx="580" cy="440" r="30" fill="#ffb27f" />
          </g>
        </svg>

        <svg viewBox="0 0 820 200" className="absolute bottom-0 inset-x-0 w-full opacity-[0.13]" preserveAspectRatio="none">
          <path d="M0 200V150h40v-20h30v20h50v-42l28-22 28 22v42h44v-58l30-24 30 24v58h60v-36h34v36h56v-70l34-26 34 26v70h50v-30h44v30h40v-46h30v46h60v-24h40v24H0z" fill="#ffffff" />
          <circle cx="238" cy="66" r="22" fill="#ffffff" />
        </svg>

        <div className="relative z-10 flex flex-col px-16 py-16">
          <span
            className="inline-flex items-center gap-2 self-start rounded-full px-3.5 py-1.5"
            style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            <Landmark size={13} style={{ color: '#cfe0ff' }} strokeWidth={2} />
            <span className="text-[12.5px] font-semibold" style={{ color: '#cfe0ff' }}>עיריית ירושלים · אגף הארנונה</span>
          </span>
          <div className="mt-8 text-white font-extrabold leading-none tracking-tight" style={{ fontSize: 80 }}>
            ארנו<span style={{ color: '#7fa8f0' }}>-נט</span>
          </div>
          <p className="mt-6 text-[17px] leading-relaxed max-w-md" style={{ color: '#a9c1f4' }}>
            סריקה אוטומטית, אימות בשטח ומעקב אכיפה אחר עסקים שמשלמים ארנונת מגורים במקום ארנונת עסקים — הכול במקום אחד.
          </p>
        </div>
      </div>
    </div>
  )
}
