import type { ReactNode, Ref } from 'react'
import type { Payment } from '../api/schemas'
import { formatDateTime, networkShortName, usualTime } from '../domain/format'
import { BODY, Row, StatusCard } from '../components/StatusCard'
import { headline } from './statusText'

// detected or confirming: money seen, not settled, so nothing here says "received".
export function WaitingScreen({
  payment,
  usualSeconds,
  notice,
  headingRef,
}: {
  payment: Payment
  usualSeconds?: number
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const { quote } = payment
  const seen = 'confirmations' in payment ? payment : undefined
  const detectedAt = 'detected_at' in payment ? payment.detected_at : undefined
  const required = seen?.required_confirmations ?? 0
  const share =
    seen && required > 0 ? Math.min(1, seen.confirmations / required) : 0
  return (
    <StatusCard
      payment={payment}
      label="Payment seen"
      amount={seen && `${seen.amount_received} ${quote.crypto_currency}`}
      timeRows={
        detectedAt && <Row label="Seen at">{formatDateTime(detectedAt)}</Row>
      }
      icon="wait"
      title={headline({ kind: 'waiting' })}
      headingRef={headingRef}
      strip="This page updates by itself."
      notice={notice}
    >
      <p className={BODY}>
        Waiting for it to be confirmed. You don't need to send anything else.
      </p>
      {seen && (
        <div className="w-full max-w-[300px] text-[13.5px]">
          <div className="flex items-baseline justify-between">
            <span>Confirmations</span>
            <span className="text-lg font-bold">{`${seen.confirmations} of ${required}`}</span>
          </div>
          <div
            aria-hidden="true"
            className="mt-1.5 h-[5px] overflow-hidden rounded-[3px] bg-[#e6e8eb]"
          >
            <div
              className="h-full bg-[#14161a]"
              style={{ width: `${share * 100}%` }}
            />
          </div>
        </div>
      )}
      {usualSeconds !== undefined && (
        <p className="text-[13px] text-gray-600">
          {`Usually about ${usualTime(usualSeconds)} on ${networkShortName(quote.network_name)}.`}
        </p>
      )}
    </StatusCard>
  )
}
