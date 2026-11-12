import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPayment, isNotFound, isQuoteNotExpired } from '../api/endpoints'
import type { Choice } from '../api/endpoints'
import type { OrderSummary } from '../api/schemas'
import { currentQuote, moneySeen } from '../domain/sequence'
import { runRequote, seedCreatedPayment } from './paymentCache'
import { readUrl, writeReference } from './url'
import { usePayment } from './usePayment'
import type { UsePaymentResult } from './usePayment'

export type CheckoutView =
  | {
      kind: 'picker'
      mode: 'create' | 'requote'
      notice: 'payment_not_found' | null
    }
  | { kind: 'payment' }

export type UseCheckoutResult = {
  order: OrderSummary // for display; only its order_id is sent
  reference: string | null
  view: CheckoutView
  payment: UsePaymentResult
  submit(choice: Choice): void // creates when there is no reference, requotes when there is one
  submitting: boolean
  submitError: unknown // null when there is none
  changeChoice(): void
  cancelChange(): void
}

export function useCheckout(): UseCheckoutResult {
  const client = useQueryClient()
  const [url] = useState(() => readUrl(window.location.search))
  const [reference, setReference] = useState(url.reference)
  const [requoting, setRequoting] = useState(false)
  const [notice, setNotice] = useState<'payment_not_found' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)
  // State reaches the next render only; two clicks before it would both see no write in flight.
  const writing = useRef(false)
  // Changes on every settled write, even when React batches submitting's true and false away.
  const [settled, setSettled] = useState(0)
  const payment = usePayment(reference)
  const entry = payment.entry
  const status = entry?.payment.status

  // Adjusted while rendering, so no frame offers a payment the server does not know.
  if (reference !== null && isNotFound(payment.error)) {
    setReference(null)
    setRequoting(false)
    setNotice('payment_not_found')
    // A requote that met the same 404 has nothing left to retry; the notice says what happened.
    setSubmitError(null)
  }
  // Closed for good: if a late partial payment then expires, a requote must not be offered again.
  if (requoting && status !== 'expired') setRequoting(false)

  useEffect(() => {
    writeReference(reference)
  }, [reference])

  // Until the render showing the result commits, a click still reaches a submit holding the old reference.
  // A layout effect runs inside the commit, before the browser can deliver a click. A passive one could
  // run after a click's write had started, and open the latch while that write is in flight.
  useLayoutEffect(() => {
    writing.current = false
  }, [settled])

  async function submit(choice: Choice) {
    if (writing.current) return
    writing.current = true
    setSubmitting(true)
    setSubmitError(null)
    setNotice(null)
    try {
      // A payment that exists is requoted, never replaced: a new one would leave its address live.
      if (reference === null) {
        const created = await createPayment({
          order_id: url.order.order_id,
          ...choice,
        })
        seedCreatedPayment(client, created, Date.now())
        setReference(created.payment_reference)
      } else {
        try {
          await runRequote(client, reference, choice)
        } catch (error) {
          // The quote was still live, and the re-read shows what the server says.
          if (!isQuoteNotExpired(error)) throw error
        }
        setRequoting(false)
      }
    } catch (error) {
      setSubmitError(error)
    } finally {
      setSubmitting(false)
      setSettled((count) => count + 1)
    }
  }

  return {
    order: url.order,
    reference,
    view:
      reference === null
        ? { kind: 'picker', mode: 'create', notice }
        : requoting
          ? { kind: 'picker', mode: 'requote', notice: null }
          : { kind: 'payment' },
    payment,
    submit: (choice) => void submit(choice),
    submitting,
    submitError,
    changeChoice: () => {
      if (status === 'expired') setRequoting(true)
      // Once money was seen on this quote, dropping the payment would stop tracking it.
      else if (
        entry?.payment.status === 'awaiting_payment' &&
        !moneySeen(currentQuote(entry.sequence))
      )
        setReference(null)
    },
    cancelChange: () => setRequoting(false),
  }
}
