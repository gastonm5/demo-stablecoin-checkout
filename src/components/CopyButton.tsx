import { useCopy } from '../hooks/useCopy'
import { Button } from './Button'

const FAILED = 'Copy failed. Select the text and copy it.'
const COPIED = 'Copied'

const CELL =
  'col-start-1 row-start-1 flex max-w-full items-center gap-1.5 text-left'
// A percentage and a length interpolate, so the width moves both ways with no measuring. `enabled:` only outranks Button's own transition classes, whatever their order in the CSS, without the !important that would beat the reduced-motion rule; the background stays listed so hover still fades.
const MOVE =
  'enabled:transition-[width,background-color] enabled:duration-[180ms] ease-[cubic-bezier(.2,0,0,1)]'
// While the width moves the label stays on one line, clipped by the button, so it shows as the button widens instead of wrapping and snapping back. A transition takes its timing from the state it goes to, so the 180 ms hold sits on the idle label; longhands, so no shorthand resets the discrete behaviour.
const ONE_LINE = '[white-space:nowrap]'
const WRAPS_AFTER_THE_MOVE =
  '[white-space:normal] [transition-property:white-space] [transition-duration:0s] [transition-delay:180ms] [transition-behavior:allow-discrete]'

// The twin and the button draw their insides from here, so the space the twin holds is the idle button's own.
function Face({
  text,
  live = false,
  wrap = '',
}: {
  text: string
  live?: boolean
  wrap?: string
}) {
  return (
    <>
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
      <span
        aria-live={live ? 'polite' : undefined}
        className={`min-w-0 wrap-anywhere ${wrap}`}
      >
        {text}
      </span>
    </>
  )
}

export function CopyButton({
  value,
  label,
  align = 'start',
}: {
  value: string
  label: string
  align?: 'start' | 'end' // end keeps the right edge still, for a button at the end of a row
}) {
  const { state, copy } = useCopy(value)
  const copied = state === 'copied'
  const failed = state === 'failed'
  return (
    <span className="inline-grid max-w-full">
      {/* The idle button, unseen, holds the width and height in the row, wrapped or not, so nothing beside or under moves while the button narrows. */}
      <Button
        variant="secondary"
        aria-hidden="true"
        inert
        tabIndex={-1}
        className={`${CELL} pointer-events-none invisible`}
      >
        <Face text={label} />
      </Button>
      <Button
        variant="secondary"
        onClick={copy}
        className={`${CELL} ${MOVE} h-0 min-h-full overflow-hidden ${align === 'end' ? 'justify-self-end' : 'justify-self-start'} ${copied ? 'w-[6.75rem] min-w-min' : 'w-full'}`}
      >
        <Face
          text={copied ? COPIED : label}
          live
          wrap={copied ? ONE_LINE : WRAPS_AFTER_THE_MOVE}
        />
      </Button>
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
