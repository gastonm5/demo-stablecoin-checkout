import { useEffect, useRef } from 'react'
import { amountsToSend, fitsDecimals } from '../domain/money'
import { deriveConnection, deriveScreen } from '../domain/screen'
import type { Connection, Screen } from '../domain/screen'
import { lastMoney } from '../domain/sequence'
import type { SequenceEntry } from '../domain/sequence'
import type { PaymentEntry } from './paymentCache'
import type { Catalogue } from './useCurrencies'
import { useNow } from './useNow'
import { useOnline } from './useOnline'
import type { UsePaymentResult } from './usePayment'

export type PaymentScreenState = {
  entry: PaymentEntry | undefined
  screen: Screen | null // null until the first answer
  connection: Connection
  detailsProblem: boolean // the pay screen cannot show its amount: the catalogue failed, lacks the quote's currency or network under its name, or an amount does not fit
  money: SequenceEntry | undefined // lastMoney of the sequence
  usualSeconds: number | undefined // from the catalogue entry for the quote's currency and network
}

export function usePaymentScreen(
  payment: UsePaymentResult,
  catalogue: Catalogue,
): PaymentScreenState {
  const now = useNow()
  const online = useOnline()
  const { entry, checkNow } = payment
  const current = entry?.payment
  const quote = current?.quote
  const currency = catalogue.currencies?.find(
    (c) => c.code === quote?.crypto_currency,
  )
  const network = currency?.networks.find((n) => n.id === quote?.network)
  const detailsChecked =
    current !== undefined &&
    currency !== undefined &&
    network?.name === current.quote.network_name &&
    amountsToSend(current).every((amount) =>
      fitsDecimals(amount, currency.decimals),
    )
  const toPay =
    current?.status === 'awaiting_payment' || current?.status === 'underpaid'
  // A list still loading is not a problem yet: until it arrives the pay screen waits.
  const detailsProblem =
    toPay &&
    (catalogue.error != null ||
      (catalogue.currencies !== undefined && !detailsChecked))

  // At zero the countdown only asks; the server decides. Once per quote, so a re-render never asks again.
  const deadlinePassed =
    current?.status === 'awaiting_payment' &&
    now >= Date.parse(current.quote.expires_at)
  const expiresAt = quote?.expires_at
  const checkedQuote = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!deadlinePassed || checkedQuote.current === expiresAt) return
    checkedQuote.current = expiresAt
    checkNow()
  }, [deadlinePassed, expiresAt, checkNow])

  return {
    entry,
    screen: entry
      ? deriveScreen({
          payment: entry.payment,
          sequence: entry.sequence,
          now,
          lastSuccessAt: payment.lastSuccessAt,
          lastFailureAt: payment.lastFailureAt,
          detailsChecked,
        })
      : null,
    connection: deriveConnection(online, payment.consecutiveFailures),
    detailsProblem,
    money: entry && lastMoney(entry.sequence.entries),
    usualSeconds: network?.avg_confirmation_seconds,
  }
}
