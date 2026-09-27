import { cn } from '../../lib/utils'

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-deep',
  accent: 'bg-accent text-white hover:bg-accent-deep',
  coral: 'bg-accent text-white hover:bg-accent-deep',
  outline: 'border border-line bg-transparent text-ink hover:border-accent hover:text-accent',
  ghost: 'text-ink-soft hover:text-accent',
}

export function Button({ className, variant = 'primary', ...props }) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-none border border-transparent px-4 text-sm font-medium tracking-[-0.01em] transition-colors duration-200 disabled:pointer-events-none disabled:opacity-45',
        variants[variant] || variants.primary,
        className
      )}
      {...props}
    />
  )
}