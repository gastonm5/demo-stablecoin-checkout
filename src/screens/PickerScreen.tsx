import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
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
import { networkColours } from '../components/networkColours'
import { Notice } from '../components/Notice'
import { OrderHeader } from '../components/OrderHeader'
import { PickerSection } from '../components/PickerSection'

const STILL_WORKING_AFTER_MS = 4_000

const note = 'text-small wrap-anywhere text-ink-subtle'
const CURRENCY_CHOSEN = 'border-ink bg-surface-sunken'
const chip = 'size-6 text-label'

const currencyText = (currency: Currency) => (
  <span className="min-w-0 wrap-anywhere">
    <b className="whitespace-nowrap">{currency.code}</b> {currency.name}
  </span>
)

const chosenNetworkLook = (networkId: string) => {
  const { border, tint } = networkColours(networkId)
  return `${border} ${tint}`
}

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
  // View state only: the section the shopper reopened with "Change".
  const [changing, setChanging] = useState<'currency' | 'network' | null>(null)
  // Adjusted while rendering: when a new currency clears the network, the closed row shrinks showing the one it had.
  const [lastNetwork, setLastNetwork] = useState(network)
  if (network && network !== lastNetwork) setLastNetwork(network)
  const closedNetwork = network ?? lastNetwork
  const currencySection = useRef<HTMLFieldSetElement>(null)
  const networkSection = useRef<HTMLFieldSetElement>(null)
  const continueButton = useRef<HTMLButtonElement>(null)

  const currencyForm = !currency || changing === 'currency' ? 'open' : 'closed'
  const networkForm = !currency
    ? 'none'
    : !network || changing === 'network'
      ? 'open'
      : 'closed'

  // Each change is committed first, so what takes focus is no longer inert.
  // A radio sits in a clipped box, which focus would otherwise scroll.
  function chooseCurrency(code: string) {
    flushSync(() => {
      if (code !== picked.currencyCode) picked.setCurrency(code)
      setChanging(null)
    })
    const networks = networkSection.current
    // The network section stays closed only on a network already chosen.
    if (networks?.querySelector('input:checked'))
      continueButton.current?.focus()
    else networks?.querySelector('input')?.focus({ preventScroll: true })
  }

  function chooseNetwork(networkId: string) {
    flushSync(() => {
      picked.setNetwork(networkId)
      setChanging((section) => (section === 'network' ? null : section))
    })
    continueButton.current?.focus()
  }

  function reopen(section: 'currency' | 'network') {
    flushSync(() => setChanging(section))
    const fieldset = section === 'currency' ? currencySection : networkSection
    fieldset.current
      ?.querySelector<HTMLInputElement>('input:checked')
      ?.focus({ preventScroll: true })
  }

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
          <h1 className="text-title font-extrabold tracking-[-.01em]">
            Choose how to pay
          </h1>
          <PickerSection
            ref={currencySection}
            legend="Currency"
            name={`${id}-currency`}
            form={currencyForm}
            options={currencies.map((c) => ({
              value: c.code,
              content: currencyText(c),
              chosenLook: CURRENCY_CHOSEN,
              accent: 'accent-ink',
            }))}
            value={picked.currencyCode}
            chosen={currency && currencyText(currency)}
            chosenLook={CURRENCY_CHOSEN}
            disabled={submitting}
            onChoose={chooseCurrency}
            onReopen={() => reopen('currency')}
          />
          <PickerSection
            ref={networkSection}
            legend="Network"
            name={`${id}-network`}
            form={networkForm}
            options={(currency?.networks ?? []).map((n) => ({
              value: n.id,
              content: (
                <>
                  <NetworkChip
                    networkId={n.id}
                    networkName={n.name}
                    className={chip}
                  />
                  <span className="min-w-0 wrap-anywhere">
                    <span className="block font-semibold">{n.name}</span>{' '}
                    <span className="block text-small text-ink-subtle">
                      {`Fee ${formatUsdFee(n.network_fee)} · usually ${usualTime(n.avg_confirmation_seconds)}`}
                    </span>
                  </span>
                </>
              ),
              chosenLook: chosenNetworkLook(n.id),
              accent: networkColours(n.id).accent,
            }))}
            value={picked.networkId}
            chosen={
              closedNetwork && (
                <>
                  <NetworkChip
                    networkId={closedNetwork.id}
                    networkName={closedNetwork.name}
                    className={chip}
                  />
                  <span className="min-w-0 font-semibold wrap-anywhere">
                    {closedNetwork.name}
                  </span>
                </>
              )
            }
            chosenLook={
              closedNetwork ? chosenNetworkLook(closedNetwork.id) : ''
            }
            disabled={submitting}
            onChoose={chooseNetwork}
            onReopen={() => reopen('network')}
          />
          {/* Each entrance on this screen plays when its element mounts, so changing the network afterwards does not replay it. */}
          {network && (
            <p className={`mt-3.5 ${note} entrance entrance-settle`}>
              {`Fee ${formatUsdFee(network.network_fee)} · usually ${usualTime(network.avg_confirmation_seconds)} · ${confirmationsLabel(network.required_confirmations)}`}
            </p>
          )}
          <div className="mt-5 flex flex-col gap-4">
            <Button
              ref={continueButton}
              variant="primary"
              busy={submitting}
              disabled={!choice}
              colours={network && networkColours(network.id)}
              className="w-full wrap-anywhere"
              onClick={() => {
                if (choice) onSubmit(choice)
              }}
            >
              {button}
            </Button>
            {currency && network && (
              <p className={`${note} entrance entrance-settle`}>
                {`Your wallet or exchange must be able to send ${currency.code} on the ${networkShortName(network.name)} network.`}
              </p>
            )}
            {stillWorking && (
              <p role="status" className={`${note} entrance entrance-fade`}>
                Still working…
              </p>
            )}
            {error != null && (
              <p
                role="alert"
                className="text-small font-semibold text-bad entrance entrance-fade"
              >
                We couldn't reach the payment service. Try again.
              </p>
            )}
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
          </div>
        </>
      }
    />
  )
}
