import type { ComponentProps } from 'react'

const PRIMARY =
  'rounded-full px-5 py-3 text-body font-bold disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-ink-muted'

const VARIANTS = {
  primary: `${PRIMARY} bg-action text-ink-inverse hover:bg-action/90 active:bg-action/80`,
  secondary:
    'rounded-control border border-line-strong bg-surface px-4 py-2.5 text-small font-semibold text-ink hover:bg-surface-sunken active:bg-line-faint disabled:cursor-not-allowed disabled:text-ink-subtle',
  link: 'text-link underline hover:no-underline disabled:cursor-not-allowed disabled:text-ink-subtle disabled:no-underline',
}

// className is for layout only: width, margin, alignment.
export function Button({
  variant,
  busy = false,
  colours,
  disabled,
  className = '',
  ...props
}: Omit<ComponentProps<'button'>, 'type'> & {
  variant: keyof typeof VARIANTS
  busy?: boolean
  colours?: { fill: string; onFill: string } // primary only: a fill and the text on it
}) {
  // Brightness, not an alpha, so hover and pressed show on any fill.
  const look =
    variant === 'primary' && colours
      ? `${PRIMARY} ${colours.fill} ${colours.onFill} hover:brightness-95 active:brightness-90 disabled:brightness-100`
      : VARIANTS[variant]
  // A write is never retried, so a busy button cannot be pressed a second time.
  return (
    <button
      {...props}
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${look} transition-colors duration-[120ms] ${className}`}
    />
  )
}
