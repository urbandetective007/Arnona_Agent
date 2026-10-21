'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Landmark } from 'lucide-react'
import { AnimatedNumber } from './ui'
import { fetchLoginStats, readLoginStats, type LoginStats } from '@/lib/loginStats'

// Property pins on the decorative map: x, y, radius, color. `ping` sends
// rings out from the high-suspicion (red) ones.
const PINS = [
  { x: 255, y: 290, r: 5, color: '#ff6b81', ping: '0s' },
  { x: 400, y: 330, r: 5, color: '#ff6b81', ping: '-0.9s' },
  { x: 330, y: 255, r: 4, color: '#ffb27f' },
  { x: 540, y: 320, r: 4, color: '#ffb27f' },
  { x: 300, y: 470, r: 4, color: '#6ee7a8' },
  { x: 480, y: 490, r: 4, color: '#8fb6ff' },
  { x: 580, y: 440, r: 5, color: '#ff6b81', ping: '-1.7s' },
]

const NEIGHBORHOODS = [
  'M180 250 L280 220 L330 300 L250 360Z',
  'M330 300 L470 260 L520 350 L420 420 L250 360Z',
  'M470 260 L620 290 L640 400 L520 350Z',
  'M250 360 L420 420 L400 550 L230 520Z',
  'M420 420 L520 350 L640 400 L620 560 L400 550Z',
]

// The status line's totals refresh while the login screen stays open.
const STATS_REFRESH_MS = 60_000

const layer = (depth: number): CSSProperties => ({ ['--depth' as string]: depth })
const indexed = (i: number): CSSProperties => ({ ['--i' as string]: i })

// The dark blue panel beside the login form: a stylized map of Jerusalem
// neighborhoods whose borders draw themselves, pins that drop in and pulse,
// and layers that shift with the pointer (drifting slowly on their own
// when the pointer is away). All motion is CSS (globals.css, "Login
// screen"); this component only feeds the pointer position.
export function LoginHero() {
  const panelRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<LoginStats | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage, which only exists on the client
    setStats(readLoginStats())
    let cancelled = false
    const refresh = () => fetchLoginStats().then(live => { if (live && !cancelled) setStats(live) })
    refresh()
    const timer = setInterval(refresh, STATS_REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let target = { x: 0, y: 0 }
    let pointerAt = 0
    const onMove = (e: PointerEvent) => {
      const r = panel.getBoundingClientRect()
      target = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 }
      pointerAt = performance.now()
    }
    const onLeave = () => { pointerAt = 0 }
    let frame = 0
    const tick = (t: number) => {
      const idle = !pointerAt || t - pointerAt > 2500
      const x = idle ? Math.sin(t / 2600) * 0.6 : target.x
      const y = idle ? Math.cos(t / 3400) * 0.45 : target.y
      panel.style.setProperty('--mx', x.toFixed(3))
      panel.style.setProperty('--my', y.toFixed(3))
      frame = requestAnimationFrame(tick)
    }
    panel.addEventListener('pointermove', onMove)
    panel.addEventListener('pointerleave', onLeave)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      panel.removeEventListener('pointermove', onMove)
      panel.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  let charIndex = 0
  const letters = (text: string, accent = false) =>
    [...text].map(ch => (
      <span key={charIndex} aria-hidden="true" className={accent ? 'login-char login-accent' : 'login-char'} style={indexed(charIndex++)}>{ch}</span>
    ))

  return (
    <div
      ref={panelRef}
      className="hidden lg:flex flex-1 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0d1b2e 0%, #062b6e 55%, #024ad8 130%)' }}
    >
      <svg viewBox="0 0 820 900" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g opacity="0.5">
          <g className="login-layer" style={layer(8)}>
            <g stroke="#4d7fd6" strokeWidth="1" opacity="0.28" fill="none">
              <path d="M-60 180h940M-60 330h940M-60 480h940M-60 630h940M-60 780h940" />
              <path d="M130 -60v1020M300 -60v1020M470 -60v1020M640 -60v1020" />
            </g>
          </g>
          <g className="login-layer" style={layer(22)}>
            <g className="login-poly" stroke="#7fa8f0" strokeWidth="1.4">
              {NEIGHBORHOODS.map((d, i) => <path key={i} d={d} pathLength={1} style={indexed(i)} />)}
            </g>
          </g>
        </g>
        <g className="login-layer" style={layer(34)}>
          <g opacity="0.32">
            <circle className="login-heat" cx="255" cy="290" r="46" fill="#ff6b81" style={{ ['--d' as string]: '0s' }} />
            <circle className="login-heat" cx="400" cy="330" r="38" fill="#ff6b81" style={{ ['--d' as string]: '-1.2s' }} />
            <circle className="login-heat" cx="580" cy="440" r="30" fill="#ffb27f" style={{ ['--d' as string]: '-2.3s' }} />
          </g>
          <g opacity="0.42" fill="none" strokeWidth="1.5">
            {PINS.filter(p => p.ping).map(p => (
              <circle key={`${p.x}-${p.y}`} className="login-ping" cx={p.x} cy={p.y} r={p.r} stroke={p.color} style={{ ['--d' as string]: p.ping }} />
            ))}
          </g>
          <g opacity="0.85">
            {PINS.map((p, i) => <circle key={`${p.x}-${p.y}`} className="login-pin" cx={p.x} cy={p.y} r={p.r} fill={p.color} style={indexed(i)} />)}
          </g>
        </g>
      </svg>

      <svg viewBox="0 0 820 200" className="absolute bottom-0 -inset-x-[5%] w-[110%] opacity-[0.13]" preserveAspectRatio="none" aria-hidden="true">
        <g className="login-layer" style={{ ['--depth' as string]: 16, ['--my' as string]: 0 }}>
          <path d="M0 200V150h40v-20h30v20h50v-42l28-22 28 22v42h44v-58l30-24 30 24v58h60v-36h34v36h56v-70l34-26 34 26v70h50v-30h44v30h40v-46h30v46h60v-24h40v24H0z" fill="#ffffff" />
          <circle cx="238" cy="66" r="22" fill="#ffffff" />
        </g>
      </svg>

      <div className="login-layer relative z-10 flex flex-col items-start px-16 py-16" style={layer(-10)}>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
          style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)' }}
        >
          <Landmark size={13} style={{ color: '#cfe0ff' }} strokeWidth={2} />
          <span className="text-[12.5px] font-semibold" style={{ color: '#cfe0ff' }}>עיריית ירושלים · אגף הארנונה</span>
        </span>
        <div className="mt-8 text-white font-extrabold leading-none tracking-tight" style={{ fontSize: 80 }}>
          <span className="sr-only">ארנו-נט</span>
          {letters('ארנו')}{letters('-נט', true)}
        </div>
        <p className="login-fade-up mt-6 text-[17px] leading-relaxed max-w-md" style={{ color: '#a9c1f4', ['--i' as string]: 8 }}>
          סריקה אוטומטית, אימות בשטח ומעקב אכיפה אחר עסקים שמשלמים ארנונת מגורים במקום ארנונת עסקים — הכול במקום אחד.
        </p>
        {stats && (
          <div
            className="login-fade-up mt-7 inline-flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px]"
            style={{ background: 'rgba(9,20,40,0.45)', border: '1px solid rgba(255,255,255,0.12)', color: '#cfe0ff', backdropFilter: 'blur(6px)', ['--i' as string]: 11 }}
          >
            <span className="live-dot" />
            <span>
              במעקב <b className="num text-white"><AnimatedNumber value={stats.total} /></b> נכסים
              {' · '}<b className="num text-white"><AnimatedNumber value={stats.high} /></b> באינדיקציה גבוהה
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
