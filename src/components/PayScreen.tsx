import type { ReactNode } from 'react'
import type { Payment } from '../api/schemas'
import { formatRemaining } from '../domain/countdown'
import { networkShortName } from '../domain/format'
import type { ClockState, Screen } from '../domain/screen'
import { CheckoutCard } from './CheckoutCard'
import { CopyButton } from './CopyButton'
import { NetworkBanner } from './NetworkBanner'
import { OrderHeader } from './OrderHeader'
import { QrFrame } from './QrFrame'

const label = 'text-xs font-semibold text-gray-500'

export function PayScreen({
  payment,
  screen,
  onChange,
  notice,
}: {
  payment: Payment // awaiting_payment or underpaid
  screen: Extract<Screen, { kind: 'pay' }>
  onChange: (() => void) | null // null hides "Change currency or network"
  notice?: ReactNode // a connection notice to show in the strip, when there is one
}) {
  const { quote } = payment
  const currency = quote.crypto_currency
  const networkName = quote.network_name
  const remaining =
    screen.mode === 'remaining' && payment.status === 'underpaid'
      ? payment
      : null
  const toSend = remaining ? remaining.amount_outstanding : quote.total_due
  // The underpaid status carries its own address: the server's latest word on where the rest goes.
  const address = remaining ? remaining.crypto_address : quote.crypto_address

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
          <OrderHeader
            orderId={payment.order_id}
            merchantName={payment.merchant.name}
            fiat={payment.order}
          />
          {remaining && (
            <p className="mb-3.5 rounded-xl border border-[#f3d999] bg-[#fff7e6] px-3.5 py-3 text-sm text-[#6b4e00]">
              <strong>Part of your payment arrived.</strong>{' '}
              {`We received ${remaining.amount_received} of ${quote.total_due} ${currency}.`}
            </p>
          )}
          <NetworkBanner
            currency={currency}
            networkId={quote.network}
            networkName={networkName}
          />
          <p className={`mb-0.5 ${label}`}>
            {remaining ? 'Send the remaining' : 'Send exactly'}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-[32px] leading-[1.1] font-extrabold tracking-[-.02em] tabular-nums break-all sm:text-[40px]">
              {`${toSend} ${currency}`}
            </p>
            <CopyButton value={toSend} label="Copy amount" />
          </div>
          {!remaining && (
            <p className="mt-1 text-[13.5px] wrap-anywhere text-gray-500">
              {`${quote.crypto_amount} ${currency} + ${quote.network_fee} ${currency} network fee · 1 ${currency} = ${quote.exchange_rate} ${payment.order.currency}`}
            </p>
          )}
          {screen.showAddress && (
            <div className="mt-5 rounded-xl border border-[#dfe3e8] bg-[#fafbfc] px-3.5 py-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
                <p className={label}>{`${networkName} address`}</p>
                <CopyButton
                  value={address}
                  label={`Copy ${networkShortName(networkName)} address`}
                />
              </div>
              <p className="font-mono text-[14.5px] font-semibold break-all">
                {address}
              </p>
            </div>
          )}
          {screen.clock === 'running' && screen.remainingMs !== null && (
            <div className="mt-5 flex items-baseline justify-between text-[13.5px]">
              <span>Rate held for</span>
              <span role="timer" className="text-lg font-bold tabular-nums">
                {formatRemaining(screen.remainingMs)}
              </span>
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
          <p className="text-center text-[14.5px] text-gray-600">
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
            <button
              type="button"
              onClick={onChange}
              className="whitespace-nowrap text-[#3b5bdb] underline"
            >
              Change currency or network
            </button>
          )}
        </div>
      }
    />
  )
}
