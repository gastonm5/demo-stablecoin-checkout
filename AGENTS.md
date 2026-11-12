# Agent instructions

This repo is a hosted crypto payment page and the mock API behind it. A shopper sends real money to an address this page shows, so a wrong network, a wrong amount or a misleading status costs them that money. Every rule below follows from that.

`CLAUDE.md` imports this file. Edit the rules here only.

## Read first

- Read `docs/design-doc.md` and `docs/adr/` before changing how the page behaves.
- When a change alters behaviour described there, update the document in the same commit.

## Money

- An amount is a string from the API response to the screen. It is never a `number`.
- Do not use `Number`, `parseFloat`, `toFixed`, unary `+` or arithmetic on an amount. The page does no maths on money; it shows the totals the server sends.
- Show crypto amounts exactly as received. Only the fiat amount follows the shopper's locale.
- Reject a response whose amount is a JSON number, is malformed, or has more decimal places than its currency allows.

## The server is the authority

- The page never decides a payment's status. No timer and no failed request may show `expired` or `failed`.
- The screen is derived by pure functions from four inputs: the server's status, the sequence of statuses seen, the device clock, and the connection state.
- A status the page does not know is not an error. It shows the "we're checking" screen and keeps polling.

## Shopper safety

- Name the network wherever an address or a QR code appears.
- Show the address and QR only on `awaiting_payment` and `underpaid`.
- Never promise an outcome the API does not state. In particular, never promise a refund.
- A copy button copies the exact string and says what it copies.

## Requests

- Reads retry themselves. Writes do not: there is no idempotency key, so a retried write can create a second payment.
- Every request has a timeout and an abort signal.
- At most one poll is in flight. Polling runs through TanStack Query only.
- Clean up every timer and listener you add.

## Structure

- Components render. Hooks own behaviour. `src/domain` is pure functions. `src/api` is the only place that talks to the server or validates a response.
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
