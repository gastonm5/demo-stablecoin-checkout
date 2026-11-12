import type { ReactNode, Ref } from 'react'
import type { Payment } from '../api/schemas'
import type { Screen } from '../domain/screen'
import type { SequenceEntry } from '../domain/sequence'
import { BODY, StatusCard } from '../components/StatusCard'
import { headline, reasonText } from './statusText'

// A dead end on purpose: a retry could leave more money stuck, so there is nothing to press.
export function FailedScreen({
  payment,
  screen,
  money,
  notice,
  headingRef,
}: {
  payment: Payment
  screen: Extract<Screen, { kind: 'failed' }>
  money?: SequenceEntry
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const { quote, merchant } = payment
  const reason = payment.status === 'failed' ? payment.reason : ''
  const seen = screen.moneySeen === 'yes'
  const received = seen ? money?.amount_received : undefined
  return (
    <StatusCard
      payment={payment}
      money={money}
      label="Payment seen"
      amount={received && `${received} ${quote.crypto_currency}`}
      icon="bad"
      title={headline(screen)}
      headingRef={headingRef}
      strip="This page can't fix this payment."
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
      <p className="text-xs text-gray-600">{`Reason code: ${reason}`}</p>
    </StatusCard>
  )
}
