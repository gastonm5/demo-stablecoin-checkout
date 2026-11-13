import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { PaymentEntry } from '../hooks/paymentCache'
import { restartMockPayment, setMockStatus } from './mockControl'
import type { MockSettings } from './mockControl'
import { openPicker, reloadPage } from './navigation'
import { useMockSettings } from './useMockSettings'

const STATUSES = [
  'awaiting_payment',
  'detected',
  'confirming',
  'paid',
  'underpaid',
  'overpaid',
  'expired',
  'failed',
]

type Option = [label: string, patch: Partial<MockSettings>]

const SETTINGS: [title: string, rows: Option[][]][] = [
  [
    'New quotes last',
    [
      [
        ['30 s', { quote_lifetime_seconds: 30 }],
        ['2 min', { quote_lifetime_seconds: 120 }],
        ['15 min', { quote_lifetime_seconds: 900 }],
      ],
    ],
  ],
  [
    'Faults, on every API request',
    [
      [
        ['no delay', { delay_ms: 0 }],
        ['3 s', { delay_ms: 3_000 }],
        ['15 s', { delay_ms: 15_000 }],
      ],
      [
        ['normal', { fault: 'none' }],
        ['HTTP 500', { fault: 'http_500' }],
        ['drop', { fault: 'drop' }],
      ],
    ],
  ],
  [
    'Server clock offset',
    [
      [
        ['−5 min', { clock_offset_seconds: -300 }],
        ['0', { clock_offset_seconds: 0 }],
        ['+5 min', { clock_offset_seconds: 300 }],
      ],
    ],
  ],
]

const matches = (
  settings: MockSettings | undefined,
  patch: Partial<MockSettings>,
) =>
  settings !== undefined &&
  Object.entries(patch).every(
    ([key, value]) => settings[key as keyof MockSettings] === value,
  )

const OPEN_KEY = 'dev-panel-open'

// A browser that refuses storage gets the panel collapsed on every load, as before it remembered.
function remembered(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === 'true'
  } catch {
    return false
  }
}

function remember(open: boolean): void {
  try {
    sessionStorage.setItem(OPEN_KEY, String(open))
  } catch {
    // See remembered.
  }
}

const SLIDE =
  'transition-[width] duration-200 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none'

const BUTTON =
  'rounded-md border border-[#39404b] px-[7px] py-[5px] text-center disabled:opacity-40 aria-pressed:border-[#fbbf24] aria-pressed:bg-[#fbbf24] aria-pressed:font-bold aria-pressed:text-[#101318]'

function Toggle(props: {
  label: string
  pressed: boolean
  disabled?: boolean
  onClick(): void
}) {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={props.onClick}
      className={BUTTON}
    >
      {props.label}
    </button>
  )
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#262c35] py-2.5">
      <h2 className="mb-[7px] text-[10.5px] tracking-[.08em] text-[#7d8796] uppercase">
        {props.title}
      </h2>
      {props.children}
    </section>
  )
}

export function DevPanel({
  reference,
  entry,
}: {
  reference: string | null
  entry: PaymentEntry | undefined
}) {
  const [open, setOpen] = useState(remembered)
  const { settings, update } = useMockSettings(open)
  const hide = useRef<HTMLButtonElement>(null)
  const tab = useRef<HTMLButtonElement>(null)

  const toggle = (next: boolean) => {
    // Committed first, so the part coming in is no longer inert when it takes focus.
    flushSync(() => setOpen(next))
    remember(next)
    const target = next ? hide.current : tab.current
    // The panel clips what is outside its width, and focus would otherwise scroll the clipped part in.
    target?.focus({ preventScroll: true })
  }

  const payment = entry?.payment
  const confirmations =
    payment && 'confirmations' in payment ? payment.confirmations : 0
  const send = (...args: [status: string, confirmations?: number]) => {
    // A failed command changes nothing; the card beside the panel shows whether a status took.
    if (reference !== null) setMockStatus(reference, ...args).catch(() => {})
  }
  // Only a reload clears the statuses the page has seen. A failed restart changes nothing, like a failed status.
  const restart = () => {
    if (reference !== null)
      restartMockPayment(reference).then(reloadPage, () => {})
  }

  return (
    <>
      {/* Holds the panel's room in the row. Under 900 px there is no room beside the card, so the open panel lies over the page. */}
      <div
        className={`w-[34px] shrink-0 ${SLIDE} ${open ? 'min-[900px]:w-[330px]' : ''}`}
      />
      <div
        className={`fixed inset-y-0 right-0 z-10 overflow-hidden ${SLIDE} ${open ? 'w-[330px]' : 'w-[34px]'}`}
      >
        {/* A fixed width, clipped by the box around it, so nothing inside reflows while it slides. */}
        <aside
          aria-label="Mock controls"
          inert={!open}
          aria-hidden={!open}
          className="h-full w-[330px] overflow-y-auto border-l border-black bg-[#101318] p-3.5 font-mono text-xs leading-[1.45] text-[#d7dce3]"
        >
          <div className="mb-3 flex items-center justify-between">
            <b className="tracking-[.08em] text-[#fbbf24]">
              DEV · MOCK CONTROLS
            </b>
            <button
              ref={hide}
              type="button"
              onClick={() => toggle(false)}
              className="rounded-md border border-[#39404b] px-2 py-0.5 text-[#9aa4b2]"
            >
              hide<span aria-hidden="true"> »</span>
            </button>
          </div>

          <Section title="Current payment">
            {reference === null ? (
              <p>No payment yet.</p>
            ) : (
              <>
                <p className="flex justify-between gap-2">
                  <span className="text-[#7d8796]">reference</span>
                  {reference}
                </p>
                <p className="text-[#9aa4b2]">
                  seen:{' '}
                  {entry?.sequence.entries
                    .map((seen) => seen.status)
                    .join(' → ')}
                </p>
              </>
            )}
          </Section>

          <Section title="Start over">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={reference === null}
                onClick={restart}
                className={BUTTON}
              >
                restart this payment
              </button>
              <button
                type="button"
                disabled={reference === null}
                onClick={openPicker}
                className={BUTTON}
              >
                new payment
              </button>
            </div>
            <p className="mt-2 text-[#7d8796]">
              restart: same reference, awaiting_payment with a fresh quote, then
              the page reloads. new: back to the picker.
            </p>
          </Section>

          <Section title="Set status">
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map((status) => (
                <Toggle
                  key={status}
                  label={status}
                  pressed={payment?.status === status}
                  disabled={reference === null}
                  onClick={() => send(status)}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[#7d8796]">confirmations</span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reference === null || confirmations === 0}
                  onClick={() => send('confirming', confirmations - 1)}
                  className={BUTTON}
                >
                  −
                </button>
                <span>
                  {payment
                    ? `${confirmations} of ${payment.quote.required_confirmations}`
                    : confirmations}
                </span>
                <button
                  type="button"
                  disabled={reference === null}
                  onClick={() => send('confirming', confirmations + 1)}
                  className={BUTTON}
                >
                  +
                </button>
              </span>
            </div>
          </Section>

          {SETTINGS.map(([title, rows]) => (
            <Section key={title} title={title}>
              {rows.map((row) => (
                <div
                  key={row[0][0]}
                  className="mb-1.5 grid auto-cols-fr grid-flow-col gap-1.5 last:mb-0"
                >
                  {row.map(([label, patch]) => (
                    <Toggle
                      key={label}
                      label={label}
                      pressed={matches(settings, patch)}
                      onClick={() => update(patch)}
                    />
                  ))}
                </div>
              ))}
            </Section>
          ))}

          <p className="border-t border-[#262c35] pt-2.5 text-[#7d8796]">
            Offline: use the browser's own offline switch.
          </p>
        </aside>
        {/* Over the content, so it fades out over it while the panel widens and back in while it narrows. */}
        {/* top-0 bottom-0, not inset-y-0: under a vertical writing mode inset-y is the horizontal pair. */}
        <button
          ref={tab}
          type="button"
          inert={open}
          aria-hidden={open}
          onClick={() => toggle(true)}
          className={`absolute top-0 bottom-0 left-0 w-[34px] border-l border-black bg-[#101318] font-mono text-xs font-bold tracking-[.1em] text-[#fbbf24] transition-opacity duration-200 ease-[cubic-bezier(.2,0,0,1)] [writing-mode:vertical-rl] motion-reduce:transition-none ${open ? 'opacity-0' : ''}`}
        >
          <span aria-hidden="true">« </span>DEV
        </button>
      </div>
    </>
  )
}
