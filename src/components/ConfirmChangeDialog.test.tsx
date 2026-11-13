import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { ConfirmChangeDialog } from './ConfirmChangeDialog'

const TITLE = 'Have you already sent a payment?'
const proto = HTMLDialogElement.prototype
const jsdomShowModal = Object.getOwnPropertyDescriptor(proto, 'showModal')
const jsdomClose = Object.getOwnPropertyDescriptor(proto, 'close')

afterEach(() => {
  if (jsdomShowModal) Object.defineProperty(proto, 'showModal', jsdomShowModal)
  else Reflect.deleteProperty(proto, 'showModal')
  if (jsdomClose) Object.defineProperty(proto, 'close', jsdomClose)
  else Reflect.deleteProperty(proto, 'close')
})

// jsdom has no showModal(); the stub does the part a test can see, opening the dialog.
function stubShowModal() {
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  Object.defineProperty(proto, 'showModal', {
    value: showModal,
    configurable: true,
    writable: true,
  })
  return showModal
}

function renderDialog(open = true) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const dialog = (isOpen: boolean) => (
    <ConfirmChangeDialog
      open={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
  const view = render(dialog(open))
  return {
    onConfirm,
    onCancel,
    setOpen: (isOpen: boolean) => view.rerender(dialog(isOpen)),
  }
}

test('opens as a modal where the browser has showModal', () => {
  const showModal = stubShowModal()
  const { setOpen } = renderDialog()
  const dialog = screen.getByRole('dialog', { name: TITLE })
  expect(showModal).toHaveBeenCalledOnce()
  expect(showModal.mock.contexts[0]).toBe(dialog)
  setOpen(true)
  expect(showModal).toHaveBeenCalledOnce()
})

test('opens once under Strict Mode, which runs the effect twice', () => {
  // As a browser does: showModal() on an open dialog throws.
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    if (this.open) throw new DOMException('Already open', 'InvalidStateError')
    this.setAttribute('open', '')
  })
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  for (const [name, value] of Object.entries({ showModal, close })) {
    Object.defineProperty(proto, name, {
      value,
      configurable: true,
      writable: true,
    })
  }
  render(
    <StrictMode>
      <ConfirmChangeDialog open onConfirm={() => {}} onCancel={() => {}} />
    </StrictMode>,
  )
  expect(screen.getByRole('dialog', { name: TITLE })).toHaveAttribute('open')
})

// Opens the dialog from a button, as the pay screen does, so focus has somewhere to go back to.
function Opener() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Change currency or network
      </button>
      <ConfirmChangeDialog
        open={open}
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

test.each([
  ['Stay on this payment', 'click'],
  ['Escape', 'cancel'],
] as const)(
  'closing with %s gives focus back to the button that opened it',
  async (_, how) => {
    // As a browser does: nothing in a closed dialog is rendered, so it cannot take focus,
    // and showModal() opens the dialog and focuses its first button.
    const focus = HTMLElement.prototype.focus
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      if (!this.closest('dialog:not([open])')) focus.call(this, options)
    })
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
      this.querySelector('button')?.focus()
    })
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    })
    for (const [name, value] of Object.entries({ showModal, close })) {
      Object.defineProperty(proto, name, {
        value,
        configurable: true,
        writable: true,
      })
    }
    render(
      <StrictMode>
        <Opener />
      </StrictMode>,
    )
    const user = userEvent.setup()
    const opener = screen.getByRole('button', {
      name: 'Change currency or network',
    })
    await user.click(opener)
    const stay = screen.getByRole('button', { name: 'Stay on this payment' })
    expect(stay).toHaveFocus()
    if (how === 'click') await user.click(stay)
    else fireEvent(screen.getByRole('dialog'), new Event('cancel'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  },
)

test('is still shown where there is no showModal', () => {
  expect(proto.showModal).toBeUndefined()
  renderDialog()
  expect(screen.getByRole('dialog', { name: TITLE })).toHaveAttribute('open')
})

test('asks first, and offers both answers', async () => {
  const { onConfirm, onCancel } = renderDialog()
  expect(
    screen.getByRole('dialog', { name: TITLE }),
  ).toHaveAccessibleDescription(
    'Only change if you have not sent anything. A payment sent to the current address after you change will not be tracked on this page.',
  )
  const stay = screen.getByRole('button', { name: 'Stay on this payment' })
  expect(stay).toHaveFocus()
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: "I haven't sent anything, change" }),
  )
  expect(onConfirm).toHaveBeenCalledOnce()
  expect(onCancel).not.toHaveBeenCalled()
  await user.click(stay)
  expect(onCancel).toHaveBeenCalledOnce()
})

test('the safe answer comes first, where showModal puts the focus', () => {
  stubShowModal()
  renderDialog()
  const [first] = screen.getAllByRole('button')
  expect(first).toHaveAccessibleName('Stay on this payment')
  expect(first).toHaveFocus()
})

test('Escape, as the native cancel event, asks the caller instead of closing', () => {
  stubShowModal()
  const { onCancel } = renderDialog()
  const cancel = new Event('cancel', { cancelable: true })
  fireEvent(screen.getByRole('dialog'), cancel)
  expect(cancel.defaultPrevented).toBe(true)
  expect(onCancel).toHaveBeenCalledOnce()
})

test('renders nothing while closed, and closing unmounts it', () => {
  stubShowModal()
  const { setOpen } = renderDialog(false)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  setOpen(true)
  expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument()
  setOpen(false)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
