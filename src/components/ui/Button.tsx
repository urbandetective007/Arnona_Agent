import type { ReactNode, ButtonHTMLAttributes } from 'react'
import Link from 'next/link'

type Variant = 'primary' | 'secondary' | 'ghost' | 'onDark'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:   'bg-brand text-white shadow-[0_4px_14px_rgba(2,74,216,0.26)] hover:bg-brand-deep',
  secondary: 'bg-surface text-charcoal border border-[#d5dce6] hover:bg-canvas',
  ghost:     'bg-transparent text-charcoal hover:bg-ink/[0.04]',
  onDark:    'bg-white text-ink hover:bg-white/90',
}

interface CommonProps {
  children: ReactNode
  variant?: Variant
  icon?: ReactNode
  className?: string
}

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
  }

interface LinkProps extends CommonProps {
  href: string
}

// Shared 44px-minimum-height button used across the app — solves the design
// review's touch-target findings by construction (nothing shorter is
// available), and replaces the per-page `btnBlue` / `btnWhiteOnDark` style
// objects that used to be redefined in page.tsx.
export function Button({ children, variant = 'primary', icon, className = '', href, ...rest }: ButtonProps | LinkProps) {
  const classes = [
    'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-[13.5px] font-semibold whitespace-nowrap transition-colors',
    VARIANT_CLASSES[variant],
    className,
  ].join(' ')

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {icon}
      {children}
    </button>
  )
}
