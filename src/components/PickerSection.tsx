import type { ReactNode, Ref } from 'react'
import { Button } from './Button'

type PickerOption = {
  value: string
  content: ReactNode
  chosenLook: string // border and background once chosen
  accent: string // the radio's colour
}

const BOX = 'flex min-h-11 items-center gap-3 rounded-control border-[1.5px]'

// Always mounted, so one form can shrink while the other grows. Every control inside sits well in from the clipped edge, so its focus outline shows whole.
function Collapse({
  shown,
  children,
}: {
  shown: boolean
  children: ReactNode
}) {
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(.2,0,0,1)] ${shown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

export function PickerSection({
  legend,
  name,
  form,
  options,
  value,
  chosen,
  chosenLook,
  disabled,
  onChoose,
  onReopen,
  ref,
}: {
  legend: 'Currency' | 'Network'
  name: string // shared by the section's radios
  form: 'open' | 'closed' | 'none'
  options: PickerOption[]
  value: string // '' when nothing is chosen
  chosen: ReactNode // the closed row's text, without the Change button
  chosenLook: string
  disabled: boolean
  onChoose(value: string): void
  onReopen(): void
  ref: Ref<HTMLFieldSetElement>
}) {
  return (
    <Collapse shown={form !== 'none'}>
      <fieldset ref={ref} disabled={disabled} className="mt-4 min-w-0">
        <legend className="mb-1.5 text-label font-semibold text-ink-subtle">
          {legend}
        </legend>
        <Collapse shown={form === 'open'}>
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <label
                key={option.value}
                className={`${BOX} cursor-pointer px-3.5 py-2 transition-colors duration-[120ms] has-disabled:cursor-not-allowed ${option.value === value ? option.chosenLook : 'border-line bg-surface'}`}
              >
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={option.value === value}
                  // A radio fires no change when the chosen one is pressed again, and that is a choice too.
                  onClick={() => {
                    if (option.value === value) onChoose(option.value)
                  }}
                  onChange={() => onChoose(option.value)}
                  className={`shrink-0 ${option.accent}`}
                />
                {option.content}
              </label>
            ))}
          </div>
        </Collapse>
        <Collapse shown={form === 'closed'}>
          {chosen != null && (
            <div className={`${BOX} py-1.5 pr-1.5 pl-3.5 ${chosenLook}`}>
              {chosen}
              <Button
                variant="secondary"
                aria-label={`Change ${legend.toLowerCase()}`}
                className="ml-auto shrink-0"
                onClick={onReopen}
              >
                Change
              </Button>
            </div>
          )}
        </Collapse>
      </fieldset>
    </Collapse>
  )
}
