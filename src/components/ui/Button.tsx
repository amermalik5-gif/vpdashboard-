import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'outline' | 'ghost' | 'onbrand' | 'onbrandGhost'
type Size = 'sm' | 'md' | 'lg'

/** DS buttons: 8px radius, hover one step darker, press two steps darker, NO scale. */
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover active:bg-brand-pressed',
  outline: 'border border-brand bg-surface text-brand hover:bg-blue-50 active:bg-blue-100',
  ghost: 'text-brand hover:bg-blue-50 active:bg-blue-100',
  onbrand: 'bg-white text-brand hover:bg-blue-50 active:bg-blue-100',
  onbrandGhost: 'border border-white/30 text-white hover:border-white/60 hover:bg-white/10 active:bg-white/15',
}
const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-2',
  md: 'h-11 px-[18px] text-sm gap-2',
  lg: 'h-12 px-[22px] text-md gap-2.5',
}

const base =
  'inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-fast ease-out disabled:pointer-events-none disabled:opacity-50'

interface Common {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconEnd?: ReactNode
  children: ReactNode
  className?: string
}

export function Button({ variant = 'primary', size = 'md', icon, iconEnd, children, className, ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={cn(base, VARIANT[variant], SIZE[size], className)}>
      {icon}
      <span>{children}</span>
      {iconEnd}
    </button>
  )
}
