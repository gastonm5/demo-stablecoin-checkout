import { useEffect, useRef } from 'react'

// A modal makes the page behind it inert and keeps the focus inside.
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    // showModal() throws on a dialog that is already open.
    if (!dialog.open) {
      // jsdom has no showModal(); there the open attribute shows the dialog, without the modal behaviour.
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    // Strict Mode runs setup, cleanup, setup: closing here lets the second setup open it again.
    return () => {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])
  return ref
}
