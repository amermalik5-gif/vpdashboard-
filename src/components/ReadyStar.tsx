import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'

/** ★ next to an item that is ready for launch; read out as «جاهز للإطلاق». */
export function ReadyStar({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span title="جاهز للإطلاق" className={cn('inline-flex shrink-0', className)}>
      <Star size={size} strokeWidth={1.75} aria-hidden style={{ fill: 'var(--ready)', color: 'var(--ready-stroke)' }} />
      <span className="sr-only">جاهز للإطلاق</span>
    </span>
  )
}
