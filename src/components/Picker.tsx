import { useId } from 'react'
import type { Choice } from '../api/endpoints'
import type { Currency } from '../api/schemas'
import {
  confirmationsLabel,
  formatUsdFee,
  networkShortName,
  usualTime,
} from '../domain/format'
import { useDelayedFlag } from '../hooks/useDelayedFlag'
import { usePickerChoice } from '../hooks/usePickerChoice'
import { CheckoutCard } from './CheckoutCard'
import { NetworkChip } from './NetworkChip'
import { OrderHeader } from './OrderHeader'

const STILL_WORKING_AFTER_MS = 4_000

const label = 'mb-1.5 block text-xs font-semibold text-gray-500'
const note = 'text-[13.5px] text-gray-500'
const menu =
  'w-full rounded-xl border-[1.5px] border-[#dfe3e8] bg-white px-3.5 py-3 font-bold disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

export function Picker({
  orderId,
  currencies,
  mode,
  notice,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  orderId: string
  currencies: Currency[]
  mode: 'create' | 'requote'
  notice: 'payment_not_found' | null
  submitting: boolean
  error: unknown
  onSubmit(choice: Choice): void
  onCancel?: () => void
}) {
  const picked = usePickerChoice(currencies)
  const { currency, network, choice } = picked
  const stillWorking = useDelayedFlag(submitting, STILL_WORKING_AFTER_MS)
  const id = useId()

  let button = 'Continue'
  if (submitting) button = 'Working…'
  else if (currency && network) {
    const action = mode === 'requote' ? 'Get a new quote' : 'Continue'
    button = `${action} with ${currency.code} on ${networkShortName(network.name)}`
  }

  return (
    <CheckoutCard
      left={
        <>
          <OrderHeader orderId={orderId} />
          {notice === 'payment_not_found' && (
            <p
              role="status"
              className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm"
            >
              We couldn't find that payment. Choose how to pay to start again.
            </p>
          )}
          <h1 className="mb-4 text-[22px] font-extrabold tracking-[-.01em]">
            Choose how to pay
          </h1>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-currency`} className={label}>
                Currency
              </label>
              <select
                id={`${id}-currency`}
                className={menu}
                value={picked.currencyCode}
                disabled={submitting}
                onChange={(event) => picked.setCurrency(event.target.value)}
              >
                <option value="" disabled>
                  Choose currency
                </option>
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {`${c.code}\u00a0 ${c.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-network`} className={label}>
                Network
              </label>
              <select
                id={`${id}-network`}
                className={menu}
                value={picked.networkId}
                disabled={submitting || !currency}
                onChange={(event) => picked.setNetwork(event.target.value)}
              >
                <option value="" disabled>
                  Choose network
                </option>
                {currency?.networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {`${n.name} · fee ${formatUsdFee(n.network_fee)} · usually ${usualTime(n.avg_confirmation_seconds)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {network && (
            <p className={`mt-3.5 ${note}`}>
              {`Fee ${formatUsdFee(network.network_fee)} · usually ${usualTime(network.avg_confirmation_seconds)} · ${confirmationsLabel(network.required_confirmations)}`}
            </p>
          )}
        </>
      }
      right={
        <>
          {currency && network && (
            <>
              <div>
                <div className={label}>You are paying with</div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#14161a] py-1.5 pr-3.5 pl-1.5 text-sm font-bold text-white">
                  <NetworkChip
                    networkId={network.id}
                    networkName={network.name}
                    className="size-[26px] text-[13px]"
                  />
                  <span>{`${currency.code} on ${network.name}`}</span>
                </div>
              </div>
              <p className={note}>
                {`Your wallet or exchange must be able to send ${currency.code} on the ${networkShortName(network.name)} network.`}
              </p>
            </>
          )}
          <button
            type="button"
            className="w-full rounded-full bg-[#14161a] px-[18px] py-3.5 text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600"
            disabled={submitting || !choice}
            onClick={() => {
              if (choice) onSubmit(choice)
            }}
          >
            {button}
          </button>
          {stillWorking && (
            <p role="status" className={note}>
              Still working…
            </p>
          )}
          {error != null && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              We couldn't reach the payment service. Try again.
            </p>
          )}
          <p className={note}>
            The amount to send and the address are shown next.
          </p>
          {mode === 'requote' && onCancel && (
            <button
              type="button"
              className="self-start text-sm font-semibold text-blue-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:text-gray-500"
              disabled={submitting}
              onClick={onCancel}
            >
              Back
            </button>
          )}
        </>
      }
    />
  )
}
