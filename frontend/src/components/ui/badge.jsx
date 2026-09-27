import { cn } from '../../lib/utils'

const variants = {
  neutral: 'border-line bg-transparent text-ink-soft',
  success: 'border-line bg-transparent text-accent',
  warning: 'border-line bg-transparent text-accent',
  danger: 'border-line bg-transparent text-accent',
  blue: 'border-line bg-transparent text-accent',
}

export function Badge({ className, variant = 'neutral', ...props }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-none border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em]', variants[variant] || variants.neutral, className)}
      {...props}
    />
  )
}