import type { ReactNode, Ref } from 'react'
import type { Payment } from '../api/schemas'
import { formatDateTime } from '../domain/format'
import { BODY, NOTICE, Row, StatusCard, WARN } from './StatusCard'
import { headline } from './statusText'

// paid or overpaid. The API says nothing about returning the extra, so neither does this page.
export function CompleteScreen({
  payment,
  notice,
  headingRef,
}: {
  payment: Payment
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const { quote, merchant } = payment
  const sum = (amount: string) => `${amount} ${quote.crypto_currency}`
  const title = headline({
    kind: 'complete',
    overpaid: payment.status === 'overpaid',
  })

  if (payment.status === 'overpaid') {
    return (
      <StatusCard
        payment={payment}
        label="Received"
        amount={sum(payment.amount_received)}
        amountRows={
          <>
            <Row label="Amount due">{sum(quote.total_due)}</Row>
            <Row label="Extra sent" className={WARN}>
              {sum(payment.amount_excess)}
            </Row>
          </>
        }
        icon="ok"
        title={title}
        headingRef={headingRef}
        strip="Your order is paid. Nothing more to send."
        notice={notice}
      >
        <p className={NOTICE}>
          <strong>{`You sent ${sum(payment.amount_excess)} more than was due.`}</strong>
          {` This page can't return the extra amount. Contact ${merchant.name} and quote reference ${payment.payment_reference}.`}
        </p>
      </StatusCard>
    )
  }

  const received =
    'amount_received' in payment ? payment.amount_received : undefined
  const settledAt = 'settled_at' in payment ? payment.settled_at : undefined
  return (
    <StatusCard
      payment={payment}
      label="Paid"
      amount={received && sum(received)}
      timeRows={
        settledAt && <Row label="Settled">{formatDateTime(settledAt)}</Row>
      }
      icon="ok"
      title={title}
      headingRef={headingRef}
      strip="Nothing more to do. You can close this page."
      notice={notice}
    >
      <p className={BODY}>
        {`${merchant.name} has your payment for order ${payment.order_id}.`}
      </p>
    </StatusCard>
  )
}
