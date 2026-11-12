import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createPayment, isNotFound, isQuoteNotExpired } from '../api/endpoints'
import type { Choice } from '../api/endpoints'
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
  orderId: string
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
  const payment = usePayment(reference)
  const status = payment.entry?.payment.status

  // Adjusted while rendering, so no frame offers a payment the server does not know.
  if (reference !== null && isNotFound(payment.error)) {
    setReference(null)
    setRequoting(false)
    setNotice('payment_not_found')
  }
  // Closed for good: if a late partial payment then expires, a requote must not be offered again.
  if (requoting && status !== 'expired') setRequoting(false)

  useEffect(() => {
    writeReference(reference)
  }, [reference])

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
          order_id: url.orderId,
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
      writing.current = false
      setSubmitting(false)
    }
  }

  return {
    orderId: url.orderId,
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
      else setReference(null)
    },
    cancelChange: () => setRequoting(false),
  }
}
