import type { ReactNode, Ref } from 'react'
import { formatDateTime } from '../domain/format'
import type { Screen } from '../domain/screen'
import { Notice } from '../components/Notice'
import { BODY, Row, StatusCard, WARN } from '../components/StatusCard'
import { headline } from './statusText'

// paid or overpaid. The API says nothing about returning the extra, so neither does this page.
export function CompleteScreen({
  screen,
  notice,
  headingRef,
}: {
  screen: Extract<Screen, { kind: 'complete' }>
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const { payment } = screen
  const { quote, merchant } = payment
  const sum = (amount: string) => `${amount} ${quote.crypto_currency}`
  const title = headline(screen)

  if (payment.status === 'overpaid') {
    return (
      <StatusCard
        payment={payment}
        label="Received"
        amount={payment.amount_received}
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
        <Notice className="text-left">
          <strong>{`You sent ${sum(payment.amount_excess)} more than was due.`}</strong>
          {` This page can't return the extra amount. Contact ${merchant.name} and quote reference ${payment.payment_reference}.`}
        </Notice>
      </StatusCard>
    )
  }

  return (
    <StatusCard
      payment={payment}
      label="Paid"
      amount={payment.amount_received}
      timeRows={<Row label="Settled">{formatDateTime(payment.settled_at)}</Row>}
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
