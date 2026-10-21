// A green circle and check mark that draw themselves — the "it worked"
// moment after an upload or a saved report.
export function SuccessCheck({ size = 56, className = 'text-clear' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 52 52"
      width={size}
      height={size}
      aria-hidden="true"
      className={`check-draw ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="26" cy="26" r="23" pathLength={1} className="opacity-90" />
      <path d="M15.5 27l7 7 14-15" pathLength={1} />
    </svg>
  )
}
