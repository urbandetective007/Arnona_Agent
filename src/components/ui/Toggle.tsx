interface ToggleProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  label?: string
  className?: string
}

// RTL-correct switch. The mockup review found toggles drawn backwards in
// Hebrew (`flex-start` positioned via absolute left/right, which doesn't
// flip with `dir`). This version uses `justify-start`/`justify-end` on a
// row flex container, which — unlike absolute offsets — follows the
// element's `direction` natively: "start" is right in RTL, left in LTR.
export function Toggle({ checked, onChange, label, className = '' }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={`inline-flex items-center h-7 w-12 rounded-full px-0.5 transition-colors shrink-0 ${
        checked ? 'bg-brand justify-end' : 'bg-ink/15 justify-start'
      } ${className}`}
    >
      <span className="block h-6 w-6 rounded-full bg-white shadow" />
    </button>
  )
}
