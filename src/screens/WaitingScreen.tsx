import type { ReactNode, Ref } from 'react'
import { formatDateTime, networkShortName, usualTime } from '../domain/format'
import type { Screen } from '../domain/screen'
import { BODY, Row, StatusCard } from '../components/StatusCard'
import { headline } from './statusText'

// detected or confirming: money seen, not settled, so nothing here says "received".
export function WaitingScreen({
  screen,
  usualSeconds,
  notice,
  headingRef,
}: {
  screen: Extract<Screen, { kind: 'waiting' }>
  usualSeconds?: number
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const { payment } = screen
  const { quote } = payment
  const detectedAt = 'detected_at' in payment ? payment.detected_at : undefined
  const required = payment.required_confirmations
  // The server may ask for no confirmations at all.
  const share = required > 0 ? Math.min(1, payment.confirmations / required) : 0
  return (
    <StatusCard
      payment={payment}
      label="Payment seen"
      amount={payment.amount_received}
      timeRows={
        detectedAt && <Row label="Seen at">{formatDateTime(detectedAt)}</Row>
      }
      icon="wait"
      title={headline(screen)}
      headingRef={headingRef}
      strip="This page updates by itself."
      notice={notice}
    >
      <p className={BODY}>
        Waiting for it to be confirmed. You don't need to send anything else.
      </p>
      <div className="w-full max-w-[300px] text-small">
        <div className="flex items-baseline justify-between">
          <span>Confirmations</span>
          <span className="text-figure font-bold">{`${payment.confirmations} of ${required}`}</span>
        </div>
        <div
          aria-hidden="true"
          className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-track"
        >
          <div
            className="h-full bg-surface-inverse transition-[width] duration-300 ease-out"
            style={{ width: `${share * 100}%` }}
          />
        </div>
      </div>
      {usualSeconds !== undefined && (
        <p className="max-w-full text-small text-ink-muted wrap-anywhere">
          {`Usually about ${usualTime(usualSeconds)} on ${networkShortName(quote.network_name)}.`}
        </p>
      )}
    </StatusCard>
  )
}
