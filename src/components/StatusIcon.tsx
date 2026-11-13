const ALERT = (
  <>
    <path d="M12 6v8" />
    <circle cx="12" cy="18.25" r="1.5" fill="currentColor" stroke="none" />
  </>
)

const ICONS = {
  wait: {
    tone: 'text-pending',
    mark: <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
  },
  clock: {
    tone: 'text-pending',
    mark: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  ok: { tone: 'text-ok', mark: <path d="M6 12.5l4 4 8-9" /> },
  warn: { tone: 'text-warn', mark: ALERT },
  bad: { tone: 'text-bad', mark: ALERT },
}

export type StatusIconKind = keyof typeof ICONS

// Decoration only: the heading beside it says what it means.
export function StatusIcon({ kind }: { kind: StatusIconKind }) {
  const { tone, mark } = ICONS[kind]
  return (
    <span
      aria-hidden="true"
      className={`flex size-14 items-center justify-center rounded-full border-[3px] border-current ${tone}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-7"
      >
        {mark}
      </svg>
    </span>
  )
}
