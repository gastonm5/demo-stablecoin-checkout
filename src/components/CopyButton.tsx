import { useCopy } from '../hooks/useCopy'
import { Button } from './Button'

const FAILED = 'Copy failed. Select the text and copy it.'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { state, copy } = useCopy(value)
  const failed = state === 'failed'
  return (
    <span className="inline-flex max-w-full flex-col">
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
        <span className="grid min-w-0 wrap-anywhere">
          {/* Unseen in the same cell, so "Copied" never narrows the button. */}
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1"
          >
            {label}
          </span>
          <span aria-live="polite" className="col-start-1 row-start-1">
            {state === 'copied' ? 'Copied' : label}
          </span>
        </span>
      </Button>
      {/* There before a failure, so the sentence is announced; it wraps inside the button's width instead of widening it. */}
      <span
        aria-live="polite"
        className={`w-0 min-w-full text-left text-small font-normal wrap-anywhere text-ink-muted ${failed ? 'mt-1' : ''}`}
      >
        {failed && (
          <span className="entrance [--entrance-duration:150ms] [--entrance-rise:0px]">
            {FAILED}
          </span>
        )}
      </span>
    </span>
  )
}
