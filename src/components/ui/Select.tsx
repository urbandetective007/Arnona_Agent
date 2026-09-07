import type { SelectHTMLAttributes } from 'react'

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-11 px-3.5 rounded-lg border border-hairline bg-surface text-[13.5px] text-ink outline-none focus:border-brand transition-colors cursor-pointer ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
}
