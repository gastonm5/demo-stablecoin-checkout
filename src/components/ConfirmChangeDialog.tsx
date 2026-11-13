import { useId } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import { Button } from './Button'

export function ConfirmChangeDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm(): void
  onCancel(): void
}) {
  const id = useId()
  const ref = useModalDialog(open)
  if (!open) return null
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onCancel={(event) => {
        // Escape: the caller owns whether this is open, so it decides, not the browser.
        event.preventDefault()
        onCancel()
      }}
      className="fixed inset-0 z-10 m-auto h-fit w-[440px] max-w-[calc(100%-32px)] rounded-card border border-line bg-surface p-6 text-ink backdrop:bg-surface-inverse/45"
    >
      <h2
        id={`${id}-title`}
        className="text-title font-extrabold tracking-[-.01em]"
      >
        Have you already sent a payment?
      </h2>
      <p id={`${id}-body`} className="mt-2 text-small text-ink-muted">
        Only change if you have not sent anything. A payment sent to the current
        address after you change will not be tracked on this page.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {/* Staying is the safe answer. showModal() focuses the first button, and autoFocus does the same without it. */}
        <Button variant="primary" autoFocus onClick={onCancel}>
          Stay on this payment
        </Button>
        <Button variant="secondary" onClick={onConfirm}>
          I haven't sent anything, change
        </Button>
      </div>
    </dialog>
  )
}
