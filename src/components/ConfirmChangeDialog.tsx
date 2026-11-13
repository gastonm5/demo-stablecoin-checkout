import { useId } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'

const button = 'rounded-full px-5 py-3 text-[15px] font-bold'

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
      className="fixed inset-0 z-10 m-auto h-fit w-[440px] max-w-[calc(100%-32px)] rounded-[22px] border border-line bg-surface p-6 text-ink backdrop:bg-surface-inverse/45"
    >
      <h2
        id={`${id}-title`}
        className="text-[22px] font-extrabold tracking-[-.01em]"
      >
        Have you already sent a payment?
      </h2>
      <p id={`${id}-body`} className="mt-2 text-[14.5px] text-ink-muted">
        Only change if you have not sent anything. A payment sent to the current
        address after you change will not be tracked on this page.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {/* Staying is the safe answer. showModal() focuses the first button, and autoFocus does the same without it. */}
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className={`${button} bg-action text-ink-inverse`}
        >
          Stay on this payment
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`${button} border border-line-strong`}
        >
          I haven't sent anything, change
        </button>
      </div>
    </dialog>
  )
}
