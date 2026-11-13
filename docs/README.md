# Documents

## Current specification

These describe the page as it is. When behaviour changes, they change in the same commit.

| File | What it is |
| --- | --- |
| [`design-doc.md`](design-doc.md) | What the page does and why: the flow, the state model, the structure, the countdown, decimals and failure states |
| [`adr/`](adr/) | The five decisions with a real trade-off |
| [`diagrams/`](diagrams/) | The figures the design doc shows, as hand-written SVG files |
| [`../AGENTS.md`](../AGENTS.md) | The rules agents work under in this repo |

## Records

These record how the work went. They are kept as written. File paths and component names in them are the ones in use at the time, and they are not updated when code moves.

| File | What it is |
| --- | --- |
| [`plan.md`](plan.md) | The task plan the build followed, task by task, with later tasks appended |
| [`agent-log.md`](agent-log.md) | A running log of disagreements with the coding agents and of their mistakes, added to as things happened |
| [`design/`](design/) | The screen drawings agreed before the build, and the HTML they were rendered from. Section 2 of the design doc lists where the build differs from them |

The agents' own per-task reports and the reviewer's raw output were working files. They are not in the repo; what mattered from them is in the log.

Names that changed after most of the records were written:

| Then | Now |
| --- | --- |
| The checkout screens in `src/components/` | `src/screens/` |
| `Picker` | `PickerScreen` |
| `ASSUMED_ORDER` in `src/hooks/url.ts` | `src/config/checkout.ts` |
