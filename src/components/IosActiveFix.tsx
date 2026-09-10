'use client'

import { useEffect } from 'react'

// iOS Safari only turns on the `:active` CSS pseudo-class for a real finger
// tap when some touch listener exists somewhere on the page — with none, a
// tap never triggers `:active` at all (only mouse/trackpad clicks do, which
// is why the site-wide press-feedback in globals.css could look fine in a
// desktop browser or an automated test yet feel completely dead on an
// iPhone). This no-op listener doesn't need to do anything; its mere
// presence is the standard fix that turns `:active` on for real touches.
export function IosActiveFix() {
  useEffect(() => {
    const noop = () => {}
    document.addEventListener('touchstart', noop, true)
    return () => document.removeEventListener('touchstart', noop, true)
  }, [])

  return null
}
