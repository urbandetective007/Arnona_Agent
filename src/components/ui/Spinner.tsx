interface SpinnerProps {
  size?: number
  className?: string
  /** Fill the parent flex/grid area and center the spinner in it. */
  fullHeight?: boolean
}

export function Spinner({ size = 32, className = '', fullHeight = false }: SpinnerProps) {
  const spinner = (
    <div
      className={`rounded-full border-[3px] border-hairline border-t-brand animate-spin ${className}`}
      style={{ width: size, height: size, animationDuration: '0.8s' }}
    />
  )
  if (!fullHeight) return spinner
  return (
    <div className="flex items-center justify-center flex-1 min-h-[60vh]">
      {spinner}
    </div>
  )
}
