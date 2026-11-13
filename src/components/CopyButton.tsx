import { useCopy } from '../hooks/useCopy'
import { Button } from './Button'

const FAILED = 'Copy failed. Select the text and copy it.'
const COPIED = 'Copied'

// A column moving between 1fr and 0fr moves the grid between its label's width and none, with no measuring.
const SLOT =
  'grid min-w-0 transition-[grid-template-columns] duration-[180ms] ease-[cubic-bezier(.2,0,0,1)]'
const UNSEEN = 'invisible min-w-0 overflow-hidden whitespace-nowrap'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { state, copy } = useCopy(value)
  const copied = state === 'copied'
  const failed = state === 'failed'
  return (
    <span className="inline-flex max-w-full flex-col">
      <Button
        variant="secondary"
        onClick={copy}
        className="inline-flex max-w-full items-center gap-1.5 self-start text-left"
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
        <span className="relative inline-flex min-w-0">
          <span
            className={`${SLOT} ${copied ? 'grid-cols-[0fr]' : 'grid-cols-[1fr]'}`}
          >
            <span aria-hidden="true" className={UNSEEN}>
              {label}
            </span>
          </span>
          <span
            className={`${SLOT} ${copied ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'}`}
          >
            <span aria-hidden="true" className={UNSEEN}>
              {COPIED}
            </span>
          </span>
          {/* Laid over the moving width, so on the way back the label shows as the button widens. */}
          <span aria-live="polite" className="absolute inset-0 truncate">
            {copied ? COPIED : label}
          </span>
        </span>
      </Button>
      {/* The secondary button's border, padding, icon and gap around the normal label, with no height: the space the button takes in the row never changes while it narrows. */}
      <span
        aria-hidden="true"
        className="invisible flex h-0 gap-1.5 overflow-hidden border-x px-4 text-small font-semibold whitespace-nowrap"
      >
        <span className="w-3.5 shrink-0" />
        {label}
      </span>
      {/* There before a failure, so the sentence is announced; it wraps inside the button's width instead of widening it. */}
      <span
        aria-live="polite"
        className={`w-0 min-w-full text-left text-small font-normal wrap-anywhere text-ink-muted ${failed ? 'mt-1' : ''}`}
      >
        {failed && <span className="entrance entrance-fade">{FAILED}</span>}
      </span>
    </span>
  )
}
