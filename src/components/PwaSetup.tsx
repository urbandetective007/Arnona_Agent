'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, Share, X } from 'lucide-react'

// Registers the service worker (offline support, public/sw.js) and offers to
// install the site as an app: Android/Chrome get a real "install" button,
// iPhone gets the two-tap instructions (Safari has no install prompt).
// Hidden when already running as an installed app, on the login page, and
// for two weeks after "לא עכשיו".

const DISMISS_KEY = 'pwa-install-dismissed-at'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaSetup() {
  const pathname = usePathname()
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/Arnona_Agent/sw.js', { scope: '/Arnona_Agent/' }).catch(() => {})
    }

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    let dismissedAt = 0
    try { dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0) } catch { /* ignore */ }
    if (standalone || Date.now() - dismissedAt < DISMISS_MS) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the environment on mount
    setHidden(false)
    const ua = navigator.userAgent
    const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
    if (isIos) setShowIos(true)

    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstallEvent(null); setHidden(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  function dismiss() {
    setHidden(true)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  if (hidden || pathname === '/login' || (!installEvent && !showIos)) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pointer-events-none" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-chrome text-white shadow-2xl p-3.5 flex items-start gap-3 animate-fade-in">
        {/* eslint-disable-next-line @next/next/no-img-element -- static icon */}
        <img src="/Arnona_Agent/icons/icon-192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold">התקנת ארנו-נט כאפליקציה</p>
          {installEvent ? (
            <p className="text-[12.5px] text-chrome-graphite mt-0.5">אייקון במסך הבית, מסך מלא, ועבודה גם בלי קליטה.</p>
          ) : (
            <p className="text-[12.5px] text-chrome-graphite mt-0.5 leading-relaxed">
              לחצו על <Share size={13} className="inline -mt-0.5 mx-0.5" /> <strong className="text-white">שיתוף</strong> בתחתית Safari, ואז על <strong className="text-white">&quot;הוסף למסך הבית&quot;</strong>.
            </p>
          )}
          {installEvent && (
            <button
              type="button"
              onClick={async () => { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); setHidden(true) }}
              className="mt-2.5 h-9 px-4 rounded-lg bg-brand text-white text-[13px] font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
            >
              <Download size={15} strokeWidth={2} /> התקנה
            </button>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="לא עכשיו" className="w-8 h-8 -m-1 rounded-lg flex items-center justify-center text-chrome-graphite hover:text-white active:scale-90 transition-transform cursor-pointer shrink-0">
          <X size={17} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
