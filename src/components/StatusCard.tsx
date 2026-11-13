import type { ReactNode, Ref } from 'react'
import type { Payment } from '../api/schemas'
import type { SequenceEntry } from '../domain/sequence'
import { CheckoutCard } from './CheckoutCard'
import { CopyButton } from './CopyButton'
import { STRIP, STRIP_TEXT } from './NoticeStrip'
import { OrderHeader } from './OrderHeader'
import { StatusIcon } from './StatusIcon'
import type { StatusIconKind } from './StatusIcon'

export const BODY = 'max-w-[320px] text-small wrap-anywhere text-ink-muted'
export const WARN = 'text-warn'

export function Row({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line-faint py-[9px] text-small">
      <dt className="shrink-0 text-ink-subtle">{label}</dt>
      <dd
        className={`min-w-0 text-right font-semibold wrap-anywhere ${className}`}
      >
        {children}
      </dd>
    </div>
  )
}

function CopyRow({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string
  copyLabel: string
}) {
  return (
    <Row label={label}>
      <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <span className="font-mono break-all">{value}</span>
        <CopyButton value={value} label={copyLabel} align="end" />
      </span>
    </Row>
  )
}

// Only the pay screen may show the address, so the card every status screen shares has no place for one.
export function StatusCard({
  payment,
  money,
  label,
  amount,
  muted = false,
  amountRows,
  timeRows,
  icon,
  title,
  headingRef,
  children,
  strip,
  notice,
  action,
}: {
  payment: Payment
  money?: SequenceEntry // supplies the transaction when the status itself carries none
  label?: string
  amount?: string // exactly as received; the card adds the quote's currency
  muted?: boolean
  amountRows?: ReactNode
  timeRows?: ReactNode
  icon: StatusIconKind
  title: string
  headingRef?: Ref<HTMLHeadingElement>
  children: ReactNode
  strip?: ReactNode
  notice?: ReactNode // a connection notice replaces the strip text
  action?: ReactNode
}) {
  const hash = 'tx_hash' in payment ? payment.tx_hash : money?.tx_hash
  return (
    <CheckoutCard
      left={
        <>
          <OrderHeader order={payment} />
          {amount && (
            <>
              <p className="mb-0.5 text-label font-semibold text-ink-subtle">
                {label}
              </p>
              <p
                className={`mb-3.5 text-amount leading-[1.1] font-extrabold tracking-[-.02em] wrap-anywhere ${muted ? 'text-ink-faint' : ''}`}
              >
                {amount}{' '}
                <span className="whitespace-nowrap">
                  {payment.quote.crypto_currency}
                </span>
              </p>
            </>
          )}
          <dl>
            {amountRows}
            <Row label="Network">{payment.quote.network_name}</Row>
            {hash && (
              <CopyRow
                label="Transaction"
                value={hash}
                copyLabel="Copy transaction hash"
              />
            )}
            <CopyRow
              label="Reference"
              value={payment.payment_reference}
              copyLabel="Copy payment reference"
            />
            {timeRows}
          </dl>
        </>
      }
      right={
        <div className="flex flex-col items-center gap-3 text-center">
          <StatusIcon kind={icon} />
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-title font-extrabold tracking-[-.01em] outline-none"
          >
            {title}
          </h1>
          {children}
        </div>
      }
      strip={
        (notice ?? strip ?? action) && (
          <div className={STRIP}>
            {notice ?? <span className={STRIP_TEXT}>{strip}</span>}
            {action}
          </div>
        )
      }
    />
  )
}
