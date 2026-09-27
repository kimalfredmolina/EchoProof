import { cn } from '../../lib/utils'

export function Input({ className, ...props }) {
  return <input className={cn('h-12 w-full rounded-none border-0 border-b border-line bg-transparent px-0 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-0', className)} {...props} />
}