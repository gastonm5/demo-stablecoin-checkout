import type { ReactNode, Ref } from 'react'
import type { Payment } from '../api/schemas'
import type { SequenceEntry } from '../domain/sequence'
import { CheckoutCard } from './CheckoutCard'
import { CopyButton } from './CopyButton'
import { OrderHeader } from './OrderHeader'

export const BODY = 'max-w-[320px] text-[14.5px] text-gray-600'
export const NOTICE =
  'rounded-xl border border-[#f3d999] bg-[#fff7e6] px-3.5 py-3 text-left text-sm text-[#6b4e00]'
export const WARN = 'text-[#b45309]'

const ICONS = {
  wait: ['text-[#6b7280]', '●'],
  clock: ['text-[#6b7280]', '◷'],
  ok: ['text-[#15803d]', '✓'],
  warn: [WARN, '!'],
  bad: ['text-[#b91c1c]', '!'],
} as const

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
    <div className="flex items-center justify-between gap-3 border-t border-[#eef0f2] py-[9px] text-sm">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className={`min-w-0 text-right font-semibold ${className}`}>
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
        <CopyButton value={value} label={copyLabel} />
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
  link,
}: {
  payment: Payment
  money?: SequenceEntry // supplies the transaction when the status itself carries none
  label?: string
  amount?: string // with its currency, exactly as received
  muted?: boolean
  amountRows?: ReactNode
  timeRows?: ReactNode
  icon: keyof typeof ICONS
  title: string
  headingRef?: Ref<HTMLHeadingElement>
  children: ReactNode
  strip?: ReactNode
  notice?: ReactNode // a connection notice replaces the strip text
  link?: ReactNode
}) {
  const hash = 'tx_hash' in payment ? payment.tx_hash : money?.tx_hash
  const [tone, glyph] = ICONS[icon]
  return (
    <CheckoutCard
      left={
        <>
          <OrderHeader order={payment} />
          {amount && (
            <>
              <p className="mb-0.5 text-xs font-semibold text-gray-500">
                {label}
              </p>
              <p
                className={`mb-3.5 text-[32px] leading-[1.1] font-extrabold tracking-[-.02em] break-all sm:text-[40px] ${muted ? 'text-[#9aa1ab]' : ''}`}
              >
                {amount}
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
          <span
            aria-hidden="true"
            className={`flex size-14 items-center justify-center rounded-full border-[3px] border-current text-[28px] font-extrabold ${tone}`}
          >
            {glyph}
          </span>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[22px] font-extrabold tracking-[-.01em] outline-none"
          >
            {title}
          </h1>
          {children}
        </div>
      }
      strip={
        (notice ?? strip ?? link) && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {notice ?? <span>{strip}</span>}
            {link}
          </div>
        )
      }
    />
  )
}
