import { useState } from 'react'
import type { OrderSummary } from '../api/schemas'
import { formatFiat } from '../domain/format'

const key = 'text-[11px] tracking-[.06em] text-gray-500 uppercase'
const value = 'text-base font-bold'

export function OrderHeader({ order }: { order: OrderSummary }) {
  const { merchant } = order
  // Keyed by URL, so a new logo gets its own try.
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const logo =
    merchant.logo_url && merchant.logo_url !== failedLogo
      ? merchant.logo_url
      : null
  return (
    <div className="mb-[22px] flex flex-wrap items-center gap-3 min-[480px]:flex-nowrap">
      <div
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#dfe3e8] bg-[#f6f7f9] font-bold"
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-contain"
            onError={() => setFailedLogo(logo)}
          />
        ) : (
          [...merchant.name][0]
        )}
      </div>
      <div className="min-w-0 flex-1 min-[480px]:flex-initial">
        <div className={key}>Payment for</div>
        <div className={`${value} wrap-anywhere`}>{merchant.name}</div>
      </div>
      {/* On a phone the order takes a row of its own, so the merchant's name keeps the width. */}
      <div className="flex w-full min-w-0 items-baseline justify-between gap-3 min-[480px]:ml-auto min-[480px]:w-auto min-[480px]:flex-col min-[480px]:items-end min-[480px]:gap-0 min-[480px]:text-right">
        <div className={`${key} min-w-0 wrap-anywhere`}>
          Order {order.order_id}
        </div>
        <div className={value}>
          {formatFiat(order.order.amount, order.order.currency)}
        </div>
      </div>
    </div>
  )
}
