import { useEffect, useRef } from 'react'
import { remainingMs } from '../domain/countdown'
import { detailsMatch } from '../domain/details'
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
  // Looked up apart from the check: a status screen shows the usual time without waiting for it.
  const network = catalogue.currencies
    ?.find((c) => c.code === quote?.crypto_currency)
    ?.networks.find((n) => n.id === quote?.network)
  const detailsChecked =
    current !== undefined &&
    catalogue.currencies !== undefined &&
    detailsMatch(current, catalogue.currencies)
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
    remainingMs(current.quote.expires_at, now) <= 0
  const expiresAt = quote?.expires_at
  // The answer in hand is newer than the deadline; and a check fired on the render that changes the reference would go to the previous query.
  const answeredSince =
    expiresAt !== undefined && payment.lastSuccessAt >= Date.parse(expiresAt)
  const checkedQuote = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!deadlinePassed || answeredSince || checkedQuote.current === expiresAt)
      return
    checkedQuote.current = expiresAt
    checkNow()
  }, [deadlinePassed, answeredSince, expiresAt, checkNow])

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
