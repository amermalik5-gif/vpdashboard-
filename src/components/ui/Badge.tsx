import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'blue' | 'teal' | 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'navy' | 'onDark'

/** DS capsule badge: *-50 background, *-700 text, matching border. */
const TONES: Record<BadgeTone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  teal: 'bg-teal-50 text-teal-700 border-teal-100',
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  info: 'bg-info-50 text-info-700 border-info-100',
  success: 'bg-success-50 text-success-700 border-success-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  danger: 'bg-danger-50 text-danger-700 border-danger-100',
  navy: 'bg-blue-900 text-white border-blue-900',
  onDark: 'bg-white/10 text-white border-white/20',
}

export function Badge({ children, tone = 'blue', size = 'sm', className }: { children: ReactNode; tone?: BadgeTone; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'xs' && 'px-2 py-px text-2xs',
        size === 'sm' && 'px-2.5 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
