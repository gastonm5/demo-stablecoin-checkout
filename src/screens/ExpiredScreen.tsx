import { useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { formatDateTime } from '../domain/format'
import type { Screen } from '../domain/screen'
import type { SequenceEntry } from '../domain/sequence'
import { Button } from '../components/Button'
import { Notice } from '../components/Notice'
import { BODY, Row, StatusCard, WARN } from '../components/StatusCard'
import { headline } from './statusText'

export function ExpiredScreen({
  screen,
  money,
  requoting,
  error,
  onRequote,
  onChange,
  notice,
  headingRef,
}: {
  screen: Extract<Screen, { kind: 'expired' }>
  money?: SequenceEntry // the entry that carried money, for the dead end
  requoting: boolean
  error: unknown
  onRequote(): void
  onChange(): void
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  // View state only: whether the shopper has said they sent nothing.
  const [ticked, setTicked] = useState(false)
  const { payment } = screen
  const { quote, merchant } = payment
  const sum = (amount: string) => `${amount} ${quote.crypto_currency}`
  const shared = {
    payment,
    money,
    title: headline(screen),
    headingRef,
    strip: 'Still checking for a late payment.',
    notice,
  }

  // Money was seen and the API does not say what happens to it: no new quote, no tick box, no change.
  if (screen.variant === 'dead_end') {
    const partial = screen.after === 'partial'
    const received = money?.amount_received
    return (
      <StatusCard
        {...shared}
        label={partial ? 'Received before it expired' : 'Payment seen'}
        amount={received}
        amountRows={
          partial && (
            <>
              <Row label="Amount due">{sum(quote.total_due)}</Row>
              {money?.amount_outstanding && (
                <Row label="Missing" className={WARN}>
                  {sum(money.amount_outstanding)}
                </Row>
              )}
            </>
          )
        }
        icon="warn"
      >
        <p className={BODY}>
          {partial
            ? 'This payment expired before the rest arrived. We are still watching in case it is on its way.'
            : 'We saw a payment before it expired.'}{' '}
          <strong>Do not send again.</strong>
        </p>
        <Notice className="text-left">
          {`This page can't complete this payment or tell you what happens to the ${received ? sum(received) : 'funds'} you sent. Contact ${merchant.name} and quote reference ${payment.payment_reference}.`}
        </Notice>
      </StatusCard>
    )
  }

  const locked = !ticked || requoting
  return (
    <StatusCard
      {...shared}
      label="Expired quote"
      amount={quote.total_due}
      muted
      timeRows={
        <Row label="Expired at">{formatDateTime(payment.expired_at)}</Row>
      }
      icon="clock"
      link={
        <Button
          variant="link"
          disabled={locked}
          onClick={onChange}
          className="whitespace-nowrap"
        >
          Change currency or network
        </Button>
      }
    >
      <p className={BODY}>
        <strong>Already sent?</strong> Do not send again. We are still watching
        for your payment.
      </p>
      {screen.variant === 'cautious' && (
        <p className={BODY}>
          {`If you sent any funds for this payment, do not get a new quote. Contact ${merchant.name}.`}
        </p>
      )}
      <label className="flex items-center gap-2 text-small font-semibold">
        <input
          type="checkbox"
          checked={ticked}
          onChange={(event) => setTicked(event.target.checked)}
          className="size-[18px]"
        />
        I have not sent a payment
      </label>
      <Button
        variant="primary"
        busy={requoting}
        disabled={!ticked}
        onClick={onRequote}
      >
        {requoting ? 'Working…' : 'Get a new quote'}
      </Button>
      {error != null && (
        <p
          role="alert"
          className="entrance entrance-fade text-small font-semibold text-bad"
        >
          We couldn't get a new quote. Try again.
        </p>
      )}
    </StatusCard>
  )
}
