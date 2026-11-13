import type { ReactNode } from 'react'
import { formatRemaining, remainingShare } from '../domain/countdown'
import { networkShortName } from '../domain/format'
import { toSend } from '../domain/money'
import type { ClockState, Screen } from '../domain/screen'
import { CheckoutCard } from '../components/CheckoutCard'
import { Button } from '../components/Button'
import { CopyButton } from '../components/CopyButton'
import { NetworkBanner } from '../components/NetworkBanner'
import { Notice } from '../components/Notice'
import { OrderHeader } from '../components/OrderHeader'
import { QrFrame } from '../components/QrFrame'

const label = 'text-label font-semibold text-ink-subtle'

export function PayScreen({
  screen,
  onChange,
  notice,
}: {
  screen: Extract<Screen, { kind: 'pay' }>
  onChange: (() => void) | null // null hides "Change currency or network"
  notice?: ReactNode // a connection notice to show in the strip, when there is one
}) {
  const { payment } = screen
  const { quote } = payment
  const currency = quote.crypto_currency
  const networkName = quote.network_name
  const remaining = screen.mode === 'remaining' ? screen.payment : null
  const { amount, address } = toSend(payment)

  const clockText = (
    {
      running: null,
      none: ['Send the rest in one transfer', 'to the same address.'],
      checking: ["Time's up.", 'Checking with the payment service.'],
      still_valid: [
        'This quote is still valid.',
        'Your device clock looks wrong, so the timer is hidden.',
      ],
      cannot_confirm: [
        "We can't confirm this quote is still live.",
        "Don't send until this page reconnects.",
      ],
    } satisfies Record<ClockState, [string, string] | null>
  )[screen.clock]

  return (
    <CheckoutCard
      left={
        <>
          <OrderHeader order={payment} />
          {remaining && (
            <Notice className="mb-3.5">
              <strong>Part of your payment arrived.</strong>{' '}
              {`We received ${remaining.amount_received} of ${quote.total_due} ${currency}.`}
            </Notice>
          )}
          <NetworkBanner
            currency={currency}
            networkId={quote.network}
            networkName={networkName}
          />
          {/* Keyed by mode so the wash plays once when underpaid arrives, not on every poll. */}
          <div
            key={screen.mode}
            className={
              remaining
                ? 'border-l-3 border-warn pl-3 motion-safe:animate-wash'
                : undefined
            }
          >
            <p
              className={`mb-0.5 text-label font-semibold ${remaining ? 'text-warn' : 'text-ink-subtle'}`}
            >
              {remaining ? 'Send the remaining' : 'Send exactly'}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-amount leading-[1.1] font-extrabold tracking-[-.02em] tabular-nums wrap-anywhere">
                {amount} <span className="whitespace-nowrap">{currency}</span>
              </p>
              <CopyButton value={amount} label="Copy amount" />
            </div>
          </div>
          {!remaining && (
            <p className="mt-1 text-small wrap-anywhere text-ink-subtle">
              {`${quote.crypto_amount} ${currency} + ${quote.network_fee} ${currency} network fee · 1 ${currency} = ${quote.exchange_rate} ${payment.order.currency}`}
            </p>
          )}
          {screen.showAddress && (
            <div className="mt-5 rounded-control border border-line bg-surface-sunken px-3.5 py-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
                <p
                  className={`min-w-0 wrap-anywhere ${label}`}
                >{`${networkName} address`}</p>
                <CopyButton
                  value={address}
                  label={`Copy ${networkShortName(networkName)} address`}
                />
              </div>
              <p className="font-mono text-small font-semibold break-all">
                {address}
              </p>
            </div>
          )}
          {screen.clock === 'running' && (
            <div className="mt-5 flex items-baseline justify-between text-small">
              <span>Rate held for</span>
              <span role="timer" className="text-figure font-bold tabular-nums">
                {formatRemaining(screen.remainingMs)}
              </span>
            </div>
          )}
          {screen.clock === 'running' && screen.lifetimeMs !== null && (
            <div
              aria-hidden="true"
              className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-track"
            >
              <div
                className="h-full bg-surface-inverse"
                style={{
                  width: `${remainingShare(screen.remainingMs, screen.lifetimeMs) * 100}%`,
                }}
              />
            </div>
          )}
        </>
      }
      right={
        screen.showAddress ? (
          <QrFrame
            address={address}
            networkId={quote.network}
            networkName={networkName}
            note={
              remaining
                ? 'Same address as before. The code holds the address only.'
                : 'The code holds the address only. Enter the amount yourself.'
            }
          />
        ) : (
          <p className="text-center text-small text-ink-muted">
            The address is hidden until we can confirm this quote.
          </p>
        )
      }
      strip={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {notice ??
            (clockText && (
              <span>
                <strong>{clockText[0]}</strong> {clockText[1]}
              </span>
            ))}
          {onChange && (
            <Button
              variant="link"
              onClick={onChange}
              className="ml-auto whitespace-nowrap"
            >
              Change currency or network
            </Button>
          )}
        </div>
      }
    />
  )
}
