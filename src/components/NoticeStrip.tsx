import type { ReactNode } from 'react'
import type { Connection } from '../domain/screen'

const dot = 'mr-2 inline-block size-[9px] rounded-full bg-[#b45309]'

// A failed request says nothing about the payment, so neither notice says it is safe.
export function connectionNotice(
  connection: Connection,
  onTryNow: () => void,
): ReactNode | null {
  if (connection === 'ok') return null
  if (connection === 'offline') {
    return (
      <span>
        <span aria-hidden="true" className={dot} />
        <strong>You appear to be offline.</strong> We'll pick up as soon as your
        connection returns.
      </span>
    )
  }
  return (
    <>
      <span>
        <span aria-hidden="true" className={dot} />
        <strong>We can't reach the payment service.</strong> This page may be
        out of date until we reconnect. Retrying.
      </span>
      <button
        type="button"
        onClick={onTryNow}
        className="rounded-[10px] border border-[#cfd4da] bg-white px-3 py-2 text-[13px] font-semibold whitespace-nowrap hover:bg-gray-50"
      >
        Try now
      </button>
    </>
  )
}
