import type { ReactNode, Ref } from 'react'
import type { Screen } from '../domain/screen'
import type { SequenceEntry } from '../domain/sequence'
import { BODY, StatusCard } from '../components/StatusCard'
import { headline, reasonText } from './statusText'

// A dead end on purpose: a retry could leave more money stuck, so there is nothing to press.
export function FailedScreen({
  screen,
  money,
  notice,
  headingRef,
}: {
  screen: Extract<Screen, { kind: 'failed' }>
  money?: SequenceEntry
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const { payment } = screen
  const { merchant, reason } = payment
  const seen = screen.moneySeen === 'yes'
  const received = seen ? money?.amount_received : undefined
  return (
    <StatusCard
      payment={payment}
      money={money}
      label="Payment seen"
      amount={received}
      icon="bad"
      title={headline(screen)}
      headingRef={headingRef}
      notice={notice}
    >
      <p className={BODY}>
        {seen
          ? `We saw your payment, but it could not be completed. ${reasonText(reason)}`
          : reasonText(reason)}
      </p>
      {screen.moneySeen === 'unknown' && (
        <p className={BODY}>
          {`If you sent any funds for this payment, tell ${merchant.name}.`}
        </p>
      )}
      <p className={BODY}>
        <strong>Do not send anything more.</strong>
        {` Contact ${merchant.name} and quote the reference.`}
      </p>
      <p className="text-label text-ink-muted">{`Reason code: ${reason}`}</p>
    </StatusCard>
  )
}
