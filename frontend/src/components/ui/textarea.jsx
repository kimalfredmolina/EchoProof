import { cn } from '../../lib/utils'

export function Textarea({ className, ...props }) {
  return <textarea className={cn('w-full resize-none rounded-none border-0 border-b border-line bg-transparent px-0 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-0', className)} {...props} />
}