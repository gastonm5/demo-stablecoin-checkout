import type { ReactNode, Ref } from 'react'
import type { Payment } from '../api/schemas'
import type { SequenceEntry } from '../domain/sequence'
import { BODY, StatusCard } from './StatusCard'
import { headline } from './statusText'

// A status the page does not know, or one that went backwards: keep polling, and leave a way forward.
export function CheckingScreen({
  payment,
  money,
  notice,
  headingRef,
}: {
  payment: Payment
  money?: SequenceEntry // supplies the transaction row when the status itself carries none
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  return (
    <StatusCard
      payment={payment}
      money={money}
      icon="wait"
      title={headline({ kind: 'checking' })}
      headingRef={headingRef}
      strip="This page updates by itself."
      notice={notice}
    >
      <p className={BODY}>
        <strong>Don't send again.</strong>
        {` If this doesn't change, contact ${payment.merchant.name} and quote reference ${payment.payment_reference}.`}
      </p>
    </StatusCard>
  )
}
