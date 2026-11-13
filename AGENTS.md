# Agent instructions

This repo is a hosted crypto payment page and the mock API behind it. A shopper sends real money to an address this page shows, so a wrong network, a wrong amount or a misleading status costs them that money. Every rule below follows from that.

`CLAUDE.md` imports this file. Edit the rules here only.

## Read first

- Read `docs/design-doc.md` and `docs/adr/` before changing how the page behaves.
- `docs/plan.md`, `docs/agent-log.md` and `docs/design/` are records of how the work went. Leave old entries as written, including their file paths.
- When a change alters behaviour described there, update the document in the same commit.

## Money

- An amount is a string from the API response to the screen. It is never a `number`.
- Do not use `Number`, `parseFloat`, `toFixed`, unary `+` or arithmetic on an amount. The page does no maths on money; it shows the totals the server sends.
- Show crypto amounts exactly as received. Only the fiat amount follows the shopper's locale.
- Reject a response whose amount is a JSON number or is malformed.
- Never show an amount to send until it has passed the decimal-places check against its currency's `decimals`.

## The server is the authority

- The page never decides a payment's status. No timer and no failed request may show `expired` or `failed`.
- The screen is derived by pure functions from the server's answer, the sequence of statuses seen, the time, the times of the last answer and the last failed request, and whether the payment's details passed the check against the currency list. The connection notice is derived from the browser's online state and the count of failed polls.
- The clock runs only while the status is `awaiting_payment`, and a stopped clock has no value. The time used is the later of the clock and the last answer, so a new quote cannot inherit an old reading.
- A status the page does not know is not an error. It shows the "we're checking" screen and keeps polling.

## Shopper safety

- Name the network wherever an address or a QR code appears.
- Show the address and QR only on `awaiting_payment` and `underpaid`, and never on `awaiting_payment` once money was seen for that quote.
- Never promise an outcome the API does not state. In particular, never promise a refund, and never say a payment is safe or unaffected because a request failed.
- A copy button copies the exact string and says what it copies.
- Never show an address unless the quote's currency and network are in the currency list under the same network name.

## Requests

- Reads retry themselves. Writes do not: there is no idempotency key, so a retried write can create a second payment.
- Every request has a timeout and an abort signal, and bypasses the HTTP cache.
- At most one poll is in flight. Polling runs through TanStack Query only.
- An answer must be about what was asked: the same reference, order and pair. Check it in `src/api`.
- Clean up every timer and listener you add.

## Structure

- Screens and components render. `src/screens` holds whole checkout screens. `src/components` holds the reusable pieces they are built from, which do not import from `src/screens`. Hooks own behaviour. `src/domain` is pure functions. `src/api` is the only place that talks to the payment API or validates a response's shape.
- A screen or a component may hold view state that nothing else reads: a ticked box, an open dialog, an open panel. Timers, requests, subscriptions, clipboard access and anything derived from server data live in a hook or in `src/domain`.
- `src/config` holds the assumed input the page starts with. It is for display before a payment exists. Once a payment is loaded, its own values are the authority for what the page shows.
- No state library. Local state lives in React state inside a custom hook.
- Do not add a dependency without asking.
- The app's request code must not know the mock exists. Only the dev panel calls the mock's control endpoints.

## Tests

- Write the test first for `src/domain` and for the polling hook.
- Write a failing test before fixing a bug.
- Tests, lint and typecheck pass before every commit.

## History

- Small commits, one concern each. The message says why.
- Never squash, amend or rewrite history. The wrong turns are part of the submission.
- Never commit `docs/requirements/`.

## The log

- When a suggestion of yours is rejected, or you get something wrong, add an entry to `docs/agent-log.md` at that moment: what you proposed, what was decided, and why.

## Scope

- Build nothing beyond the design doc.
- When payment behaviour is unclear, stop and ask. Do not guess.

## Comments

- A comment explains why, never what. No issue or PR numbers in code.

## Commands

- `npm run dev`: the page and the mock, on one port.
- `npm run check`: lint, typecheck and tests. Run before every commit.
- `npm test -- path/to/file.test.ts`: one test file.
