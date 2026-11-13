import { useCopy } from '../hooks/useCopy'
import { Button } from './Button'

const FEEDBACK = {
  copied: 'Copied',
  failed: 'Copy failed. Select the text and copy it.',
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { state, copy } = useCopy(value)
  return (
    <Button
      variant="secondary"
      onClick={copy}
      className="inline-flex max-w-full items-center gap-1.5 text-left"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-3.5 shrink-0"
      >
        <rect x="5" y="5" width="9" height="9" rx="2" />
        <path d="M11 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1" />
      </svg>
      <span aria-live="polite" className="min-w-0 wrap-anywhere">
        {state === 'idle' ? label : FEEDBACK[state]}
      </span>
    </Button>
  )
}
