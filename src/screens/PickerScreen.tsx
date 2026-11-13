import { useId } from 'react'
import type { Choice } from '../api/endpoints'
import type { Currency, OrderSummary } from '../api/schemas'
import {
  confirmationsLabel,
  formatUsdFee,
  networkShortName,
  usualTime,
} from '../domain/format'
import { useDelayedFlag } from '../hooks/useDelayedFlag'
import { usePickerChoice } from '../hooks/usePickerChoice'
import { Button } from '../components/Button'
import { CheckoutCard } from '../components/CheckoutCard'
import { NetworkChip } from '../components/NetworkChip'
import { Notice } from '../components/Notice'
import { OrderHeader } from '../components/OrderHeader'

const STILL_WORKING_AFTER_MS = 4_000

const label = 'mb-1.5 block text-label font-semibold text-ink-subtle'
const note = 'text-small wrap-anywhere text-ink-subtle'
// Each plays when its element mounts, so changing the network afterwards does not replay it.
const settle = 'entrance [--entrance-duration:160ms] [--entrance-rise:6px]'
const fade = 'entrance [--entrance-duration:150ms] [--entrance-rise:0px]'
const menu =
  'peer w-full appearance-none rounded-control border-[1.5px] border-line bg-surface py-3 pr-10 pl-3.5 font-bold transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle'
const chevron = (
  <svg
    aria-hidden="true"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    className="pointer-events-none absolute top-1/2 right-3.5 size-3 -translate-y-1/2 peer-disabled:text-ink-subtle"
  >
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
)

export function PickerScreen({
  order,
  currencies,
  mode,
  notice,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  order: OrderSummary
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
          <OrderHeader order={order} />
          {notice === 'payment_not_found' && (
            <Notice role="status" className="mb-4">
              We couldn't find that payment. Choose how to pay to start again.
            </Notice>
          )}
          <h1 className="mb-4 text-title font-extrabold tracking-[-.01em]">
            Choose how to pay
          </h1>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-currency`} className={label}>
                Currency
              </label>
              <div className="relative">
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
                {chevron}
              </div>
            </div>
            <div>
              <label htmlFor={`${id}-network`} className={label}>
                Network
              </label>
              <div className="relative">
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
                      {/* The closed menu shows the selected option's text, so the chosen one has the name alone to fit; its fee and time are on the line below. */}
                      {n.id === picked.networkId
                        ? n.name
                        : `${n.name} · fee ${formatUsdFee(n.network_fee)} · usually ${usualTime(n.avg_confirmation_seconds)}`}
                    </option>
                  ))}
                </select>
                {chevron}
              </div>
            </div>
          </div>
          {network && (
            <p className={`mt-3.5 ${note} ${settle}`}>
              {`Fee ${formatUsdFee(network.network_fee)} · usually ${usualTime(network.avg_confirmation_seconds)} · ${confirmationsLabel(network.required_confirmations)}`}
            </p>
          )}
        </>
      }
      right={
        <>
          {currency && network && (
            <>
              <div className={settle}>
                <div className={label}>You are paying with</div>
                <div className="inline-flex items-center gap-2 rounded-full bg-surface-inverse py-1.5 pr-3.5 pl-1.5 text-small font-bold text-ink-inverse">
                  <NetworkChip
                    networkId={network.id}
                    networkName={network.name}
                    className="size-[26px] text-small"
                  />
                  <span className="min-w-0 wrap-anywhere">{`${currency.code} on ${network.name}`}</span>
                </div>
              </div>
              <p className={`${note} ${settle}`}>
                {`Your wallet or exchange must be able to send ${currency.code} on the ${networkShortName(network.name)} network.`}
              </p>
            </>
          )}
          <Button
            variant="primary"
            busy={submitting}
            disabled={!choice}
            className="w-full wrap-anywhere"
            onClick={() => {
              if (choice) onSubmit(choice)
            }}
          >
            {button}
          </Button>
          {stillWorking && (
            <p role="status" className={`${note} ${fade}`}>
              Still working…
            </p>
          )}
          {error != null && (
            <p
              role="alert"
              className={`text-small font-semibold text-bad ${fade}`}
            >
              We couldn't reach the payment service. Try again.
            </p>
          )}
          <p className={note}>
            The amount to send and the address are shown next.
          </p>
          {mode === 'requote' && onCancel && (
            <Button
              variant="link"
              className="self-start"
              disabled={submitting}
              onClick={onCancel}
            >
              Back
            </Button>
          )}
        </>
      }
    />
  )
}
