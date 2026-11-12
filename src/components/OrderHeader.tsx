import type { DecimalString } from '../api/schemas'
import { formatFiat } from '../domain/format'

const key = 'text-[11px] tracking-[.06em] text-gray-500 uppercase'
const value = 'text-base font-bold'

export function OrderHeader({
  orderId,
  merchantName,
  fiat,
}: {
  orderId: string
  merchantName?: string
  fiat?: { amount: DecimalString; currency: string }
}) {
  if (!merchantName) {
    return (
      <div className="mb-[22px]">
        <div className={key}>Order</div>
        <div className={value}>{orderId}</div>
      </div>
    )
  }
  return (
    <div className="mb-[22px] flex items-center gap-3">
      <div
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-[#dfe3e8] bg-[#f6f7f9] font-bold"
      >
        {[...merchantName][0]}
      </div>
      <div className="min-w-0">
        <div className={key}>Payment for</div>
        <div className={value}>{merchantName}</div>
      </div>
      <div className="ml-auto text-right">
        <div className={key}>Order {orderId}</div>
        {fiat && (
          <div className={value}>{formatFiat(fiat.amount, fiat.currency)}</div>
        )}
      </div>
    </div>
  )
}
