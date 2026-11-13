import type { ComponentProps } from 'react'

export function Notice({ className = '', ...props }: ComponentProps<'p'>) {
  return (
    <p
      {...props}
      className={`rounded-control border border-warn-line bg-warn-surface px-3.5 py-3 text-small text-warn-ink wrap-anywhere ${className}`}
    />
  )
}
