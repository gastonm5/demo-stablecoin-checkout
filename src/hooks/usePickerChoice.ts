import { useState } from 'react'
import type { Choice } from '../api/endpoints'
import type { Currency, Network } from '../api/schemas'

export type PickerChoice = {
  currencyCode: string // '' when nothing is chosen
  networkId: string // '' when nothing is chosen
  currency: Currency | undefined
  network: Network | undefined
  choice: Choice | null // set only when both are chosen
  setCurrency(code: string): void // clears the network, unless the currency has exactly one, which it selects
  setNetwork(id: string): void
}

export function usePickerChoice(currencies: Currency[]): PickerChoice {
  const [{ currencyCode, networkId }, setSelection] = useState({
    currencyCode: '',
    networkId: '',
  })
  const networksOf = (code: string) =>
    currencies.find((currency) => currency.code === code)?.networks ?? []
  const currency = currencies.find((c) => c.code === currencyCode)
  const network = currency?.networks.find((n) => n.id === networkId)

  return {
    currencyCode,
    networkId,
    currency,
    network,
    choice:
      currency && network
        ? { currency: currency.code, network: network.id }
        : null,
    setCurrency(code) {
      const networks = networksOf(code)
      // A network carried over from another currency would be a choice the shopper never made.
      setSelection({
        currencyCode: code,
        networkId: networks.length === 1 ? networks[0].id : '',
      })
    },
    setNetwork(id) {
      setSelection((selection) =>
        networksOf(selection.currencyCode).some((n) => n.id === id)
          ? { ...selection, networkId: id }
          : selection,
      )
    },
  }
}
