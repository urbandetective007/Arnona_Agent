'use client'

import { useEffect, useState } from 'react'
import { Download, MoreVertical, Share, SquarePlus, X } from 'lucide-react'

// Installing the site as an app ("הוסף למסך הבית"), in one place:
// - registers the service worker (offline support, public/sw.js);
// - keeps Chrome's install prompt (`beforeinstallprompt`) when it fires;
// - shows a dismissible banner once in a while, and
// - an install sheet with one-tap install (when Chrome offers it) or the
//   steps for this phone/browser. Any page opens the sheet with
//   openInstallSheet(); InstallLink is a ready-made button for that.

const DISMISS_KEY = 'pwa-install-dismissed-at'
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000
const OPEN_EVENT = 'arnona:open-install'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
type Platform = 'ios-safari' | 'ios-other' | 'android' | 'desktop'

export function openInstallSheet() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  if (ios) return /CriOS|FxiOS|EdgiOS|GSA\//.test(ua) ? 'ios-other' : 'ios-safari'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** True when the page runs as the installed app — install links hide themselves then. */
export function useIsInstalled(): boolean {
  const [installed, setInstalled] = useState(true)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read once on mount (unknown during prerender)
  useEffect(() => { setInstalled(isInstalled()) }, [])
  return installed
}

/** A small "install the app" link for footers and menus; hidden inside the installed app. */
export function InstallLink({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  const installed = useIsInstalled()
  if (installed) return null
  return (
    <button type="button" onClick={openInstallSheet} className={`inline-flex items-center gap-1.5 cursor-pointer ${className}`}>
      <Download size={14} strokeWidth={2} />
      {children ?? 'התקנת האפליקציה'}
    </button>
  )
}

export function PwaSetup() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [installed, setInstalled] = useState(true)
  const [bannerOpen, setBannerOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/Arnona_Agent/sw.js', { scope: '/Arnona_Agent/' }).catch(() => {})
    }
    const p = detectPlatform()
    const standalone = isInstalled()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the environment on mount
    setPlatform(p)
    setInstalled(standalone)

    let dismissedAt = 0
    try { dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0) } catch { /* ignore */ }
    // The banner is for phones; on a computer the menu link is enough.
    if (!standalone && p !== 'desktop' && Date.now() - dismissedAt > DISMISS_MS) setBannerOpen(true)

    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstallEvent(null); setInstalled(true); setBannerOpen(false); setSheetOpen(false) }
    const onOpen = () => setSheetOpen(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  function dismissBanner() {
    setBannerOpen(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    setInstallEvent(null)
    if (outcome === 'accepted') { setSheetOpen(false); setBannerOpen(false) }
  }

  if (installed) return null
  // Keep the banner off the surveyor's report form and other full-screen sheets: it sits at the very bottom.
  const showBanner = bannerOpen && !sheetOpen

  return (
    <>
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pointer-events-none" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-chrome text-white shadow-2xl p-3.5 flex items-center gap-3 animate-fade-in">
            {/* eslint-disable-next-line @next/next/no-img-element -- static icon */}
            <img src="/Arnona_Agent/icons/icon-192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold">התקנת ארנו-נט כאפליקציה</p>
              <p className="text-[12px] text-chrome-graphite mt-0.5">אייקון במסך הבית, מסך מלא, ועבודה גם בלי קליטה.</p>
            </div>
            <button
              type="button"
              onClick={() => (installEvent ? install() : setSheetOpen(true))}
              className="shrink-0 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-semibold active:scale-95 transition-transform cursor-pointer"
            >
              {installEvent ? 'התקנה' : 'איך מתקינים?'}
            </button>
            <button type="button" onClick={dismissBanner} aria-label="לא עכשיו" className="w-8 h-8 -me-1 rounded-lg flex items-center justify-center text-chrome-graphite hover:text-white active:scale-90 transition-transform cursor-pointer shrink-0">
              <X size={17} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-[60] bg-black/45 flex items-end sm:items-center justify-center" onClick={() => setSheetOpen(false)} role="dialog" aria-modal="true" aria-label="התקנת האפליקציה">
          <div
            className="w-full max-w-md bg-surface rounded-t-2xl sm:rounded-2xl p-5 animate-fade-in"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- static icon */}
              <img src="/Arnona_Agent/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-bold text-ink">התקנת ארנו-נט</p>
                <p className="text-[12.5px] text-subtle">אייקון במסך הבית, מסך מלא, ועבודה גם בלי קליטה</p>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="סגירה" className="w-9 h-9 rounded-full flex items-center justify-center text-charcoal hover:bg-canvas active:scale-90 transition-[background-color,transform] cursor-pointer">
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {installEvent ? (
              <button type="button" onClick={install} className="mt-5 w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-brand-deep active:scale-[0.98] transition-[background-color,transform] cursor-pointer">
                <Download size={18} strokeWidth={2.2} /> התקנה
              </button>
            ) : (
              <ol className="mt-5 flex flex-col gap-3">
                {stepsFor(platform).map((step, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="num w-7 h-7 rounded-full bg-brand/10 text-brand text-[13px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-[14px] text-ink leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-canvas border border-hairline text-[13px] font-semibold align-middle">{children}</span>
)

function stepsFor(platform: Platform): React.ReactNode[] {
  switch (platform) {
    case 'ios-safari':
      return [
        <>לוחצים על כפתור השיתוף <Key><Share size={14} /> שיתוף</Key> בסרגל התחתון של Safari</>,
        <>גוללים מטה ובוחרים <Key><SquarePlus size={14} /> הוסף למסך הבית</Key></>,
        <>לוחצים <Key>הוסף</Key> — האייקון של ארנו-נט יופיע במסך הבית</>,
      ]
    case 'ios-other':
      return [
        <>לוחצים על כפתור השיתוף <Key><Share size={14} /></Key> (בשורת הכתובת או בתפריט)</>,
        <>בוחרים <Key><SquarePlus size={14} /> הוסף למסך הבית</Key></>,
        <>אם האפשרות לא מופיעה — פותחים את האתר ב-Safari ומתקינים משם</>,
      ]
    case 'android':
      return [
        <>לוחצים על התפריט <Key><MoreVertical size={14} /></Key> בפינה העליונה של Chrome</>,
        <>בוחרים <Key>התקנת אפליקציה</Key> או <Key>הוספה למסך הבית</Key></>,
        <>מאשרים — האייקון של ארנו-נט יופיע במסך הבית</>,
      ]
    default:
      return [
        <>ב-Chrome או Edge: לוחצים על סמל ההתקנה <Key><Download size={14} /></Key> בצד שורת הכתובת</>,
        <>או מהתפריט: <Key>שמירה ושיתוף</Key> ← <Key>התקנת הדף כאפליקציה</Key></>,
      ]
  }
}
