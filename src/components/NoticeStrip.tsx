import { Fragment } from 'react'
import type { ReactNode } from 'react'
import type { Connection } from '../domain/screen'
import { Button } from './Button'

const dot = 'mr-2 inline-block size-[9px] rounded-full bg-warn'

// A strip's text takes the room on the left and wraps there, so what follows it stays together on the right; on a phone that drops under the text.
export const STRIP = 'flex flex-wrap items-center justify-end gap-x-4 gap-y-2'
export const STRIP_TEXT = 'min-w-0 grow basis-full md:basis-0'

// A failed request says nothing about the payment, so neither notice says it is safe.
export function connectionNotice(
  connection: Connection,
  onTryNow: () => void,
): ReactNode | null {
  if (connection === 'ok') return null
  // One keyed fragment for both: the notice never takes over the strip text's elements, which would not fade in, and going from one notice to the other keeps its text's element, so the fade does not replay.
  if (connection === 'offline') {
    return (
      <Fragment key="connection">
        <span className={`${STRIP_TEXT} entrance entrance-fade`}>
          <span aria-hidden="true" className={dot} />
          <strong>You appear to be offline.</strong> We'll pick up as soon as
          your connection returns.
        </span>
      </Fragment>
    )
  }
  return (
    <Fragment key="connection">
      <span className={`${STRIP_TEXT} entrance entrance-fade`}>
        <span aria-hidden="true" className={dot} />
        <strong>We can't reach the payment service.</strong> This page may be
        out of date until we reconnect. Retrying.
      </span>
      {/* The button's own transition is its colour, so the fade is on a wrapper. */}
      <span className="flex entrance entrance-fade">
        <Button
          variant="secondary"
          onClick={onTryNow}
          className="whitespace-nowrap"
        >
          Try now
        </Button>
      </span>
    </Fragment>
  )
}
