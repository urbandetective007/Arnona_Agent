import type { InputHTMLAttributes } from 'react'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-11 px-3.5 rounded-lg border border-hairline bg-surface text-[13.5px] text-ink placeholder:text-subtle outline-none focus:border-brand transition-colors ${className}`}
      {...rest}
    />
  )
}
