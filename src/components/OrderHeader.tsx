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
    <div className="mb-[22px] flex items-center gap-3">
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
      <div className="min-w-0">
        <div className={key}>Payment for</div>
        <div className={value}>{merchant.name}</div>
      </div>
      <div className="ml-auto text-right">
        <div className={key}>Order {order.order_id}</div>
        <div className={value}>
          {formatFiat(order.order.amount, order.order.currency)}
        </div>
      </div>
    </div>
  )
}
