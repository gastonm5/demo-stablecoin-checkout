import { useEffect, useRef } from 'react'

// A modal makes the page behind it inert and keeps the focus inside.
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    // jsdom has no showModal(); there the open attribute shows the dialog, without the modal behaviour.
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }, [open])
  return ref
}
