import { useId } from 'react'

const button = 'rounded-full px-5 py-3 text-[15px] font-bold'

// Shown through the open attribute, not showModal(), which jsdom does not implement.
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
  if (!open) return null
  return (
    <dialog
      open
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
      className="fixed inset-0 z-10 m-auto h-fit w-[440px] max-w-[calc(100%-32px)] rounded-[22px] border border-[#dfe3e8] bg-white p-6 text-[#14161a] shadow-[0_0_0_100vmax_rgba(20,22,26,.45)]"
    >
      <h2
        id={`${id}-title`}
        className="text-[22px] font-extrabold tracking-[-.01em]"
      >
        Have you already sent a payment?
      </h2>
      <p id={`${id}-body`} className="mt-2 text-[14.5px] text-gray-600">
        Only change if you have not sent anything. A payment sent to the current
        address after you change will not be tracked on this page.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onConfirm}
          className={`${button} border border-[#cfd4da]`}
        >
          I haven't sent anything, change
        </button>
        {/* Staying is the safe answer, so it has the focus. */}
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className={`${button} bg-[#14161a] text-white`}
        >
          Stay on this payment
        </button>
      </div>
    </dialog>
  )
}
