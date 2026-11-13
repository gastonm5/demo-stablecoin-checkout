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
  if (connection === 'offline') {
    return (
      <span className={STRIP_TEXT}>
        <span aria-hidden="true" className={dot} />
        <strong>You appear to be offline.</strong> We'll pick up as soon as your
        connection returns.
      </span>
    )
  }
  return (
    <>
      <span className={STRIP_TEXT}>
        <span aria-hidden="true" className={dot} />
        <strong>We can't reach the payment service.</strong> This page may be
        out of date until we reconnect. Retrying.
      </span>
      <Button
        variant="secondary"
        onClick={onTryNow}
        className="whitespace-nowrap"
      >
        Try now
      </Button>
    </>
  )
}
