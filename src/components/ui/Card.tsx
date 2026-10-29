import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Hover: lift −2px + one shadow step (DS). Use for clickable cards. */
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const PAD = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-6 md:p-8' }

/** DS card: white, 1px #e4e6ea border, 12–16px radius, shadow xsm→sm. */
export function Card({ children, interactive, padding = 'md', className, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        'relative rounded-xl border border-line-subtle bg-surface shadow-xsm',
        PAD[padding],
        interactive && 'transition-[transform,box-shadow,border-color] duration-base ease-standard hover:-translate-y-0.5 hover:shadow-sm focus-within:-translate-y-0.5 focus-within:shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
