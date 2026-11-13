# Stablecoin Checkout

The hosted payment page a shopper lands on after choosing "Pay with crypto", with the mock API behind it. Built for Triple-A's frontend take-home.

Current specification:

| Document                                   | What it is                               |
| ------------------------------------------ | ---------------------------------------- |
| [`docs/design-doc.md`](docs/design-doc.md) | What I built and why                     |
| [`docs/adr/`](docs/adr/)                   | The five decisions with a real trade-off |
| [`AGENTS.md`](AGENTS.md)                   | The rules the coding agents worked under |

Records of how the work went, kept as written:

| Document                                 | What it is                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| [`docs/agent-log.md`](docs/agent-log.md) | Where the agents and I disagreed, and what they got wrong, written as it happened |
| [`docs/plan.md`](docs/plan.md)           | The task plan the build followed                                                  |
| [`docs/design/`](docs/design/)           | The screen drawings agreed before the build                                       |

[`docs/README.md`](docs/README.md) says more about which is which.

## Run it

Needs Node 22.12 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The page and the mock API run in one process on one port. If that port is taken, Vite prints the one it used; use it in the `curl` examples below too.

| Command         | What it does                     |
| --------------- | -------------------------------- |
| `npm run dev`   | The page and the mock            |
| `npm run check` | Lint, typecheck and tests        |
| `npm run build` | Typecheck and a production build |

Two URL parameters:

- `?order_id=ORD-1` sets the order id. Without it the page uses `ORD-88213`. The merchant and the amount in the header before a payment exists come from an assumed order summary; the design doc's section 9 says where a real page would get it.
- `?payment=AQH-100306-PMT` appears once a payment exists. Reloading resumes that payment.

## Project structure

```
src/
  main.tsx
  App.tsx
  api/          HTTP client, response schemas and endpoint functions
  domain/       Pure payment, history, money and presentation derivation
  screens/      Complete checkout screens and screen-specific helpers
  components/   Reusable rendering components
  hooks/        Checkout orchestration and browser effects
  config/       Initial checkout configuration
  dev/          Browser-side mock controls
  test/         Shared test helpers and fixtures
mock/           Express mock server and its fixtures
docs/           Current specifications and historical material
```

- **Screens and components only render.** A screen is one whole state of the checkout; a component is a piece screens share. Behaviour lives in `hooks/`, and decisions live in `domain/` as pure functions.
- **`api/` is the only code that talks to the server** or checks the shape of an answer.
- **`config/` holds what the page assumes it is handed** before a payment exists: the order summary shown on the first screen. It is for display. Once a payment is loaded, the server's values are what the page shows.
- **Only `dev/` knows the mock exists.**

## Trigger each payment state

### With the dev panel

Click the **DEV** tab on the right edge of the page. The panel sits beside the checkout card, so you can change something and watch the page react.

| To see                      | Do this                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Any payment status          | Create a payment, then press that status under **Set status**. The eight buttons work in any order |
| Confirmations moving        | Use the **confirmations − n +** stepper                                                            |
| The countdown reaching zero | Set **New quotes last** to 30 s, then create a payment                                             |
| A slow response             | Set **Faults** to 3 s. 15 s is longer than the page's 10 s timeout                                 |
| A server error              | Set **Faults** to HTTP 500                                                                         |
| A network error             | Set **Faults** to drop, which closes the connection with no response                               |
| A clock difference          | Set **Server clock offset** to −5 min or +5 min, then create a payment                             |
| An offline browser          | Use the browser's own switch: DevTools, Network, Offline                                           |

A fault applies to every API request until you switch it back to "normal" or "no delay".

Once a payment is `paid`, `overpaid` or `failed`, the page stops asking the server about it. A status set after that shows only after a reload. To try another sequence, start a new payment.

### With curl

The same controls are plain HTTP. The payment reference is in the page's URL after `?payment=`.

```bash
# Set a status: awaiting_payment, detected, confirming, paid, underpaid, overpaid, expired, failed
curl -X POST localhost:5173/__mock/payments/AQH-100306-PMT/status \
  -H 'content-type: application/json' -d '{"status":"underpaid"}'

# confirming takes a count
curl -X POST localhost:5173/__mock/payments/AQH-100306-PMT/status \
  -H 'content-type: application/json' -d '{"status":"confirming","confirmations":2}'

# Change the mock's settings. Send any of these fields.
curl -X POST localhost:5173/__mock/settings -H 'content-type: application/json' \
  -d '{"quote_lifetime_seconds":30,"delay_ms":3000,"fault":"drop","clock_offset_seconds":-300}'

# fault is one of: none, http_500, drop. Put everything back:
curl -X POST localhost:5173/__mock/settings -H 'content-type: application/json' \
  -d '{"quote_lifetime_seconds":900,"delay_ms":0,"fault":"none","clock_offset_seconds":0}'

# See the settings and every payment
curl localhost:5173/__mock/state
```

### Sequences worth trying

Single statuses are the easy part. These show the decisions in the design doc:

| Try this                                                             | What the page does                                                                                                                                                                                                                                       | Why                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `underpaid`, then `expired`                                          | A dead end: no new quote, the reference, and "contact the merchant"                                                                                                                                                                                      | The API does not say what happens to money already sent ([ADR 0003](docs/adr/0003-partial-and-late-payments.md))                                                                                               |
| `detected`, then `awaiting_payment`                                  | "We're checking your payment", with no address                                                                                                                                                                                                           | A stale answer must not invite a second payment                                                                                                                                                                |
| A 30 s quote, left alone                                             | At zero the page hides the address and asks the server, then shows the expired screen, where a tick box guards "Get a new quote". Add a 3 s delay under **Faults** to keep "Time's up. Checking with the payment service." on screen long enough to read | Only the server decides a quote has expired ([ADR 0001](docs/adr/0001-server-decides-expiry.md))                                                                                                               |
| Clock offset −5 min with a 30 s quote                                | "This quote is still valid", the address, and no timer                                                                                                                                                                                                   | The device clock is wrong, so the page stops showing a number it cannot trust                                                                                                                                  |
| Clock offset +5 min with a 30 s quote                                | The countdown still shows time when the page moves to expired                                                                                                                                                                                            | The server wins                                                                                                                                                                                                |
| **drop** on a live quote                                             | The address stays and a notice appears. At zero the address is hidden                                                                                                                                                                                    | A lost connection never shows as `failed` or `expired`                                                                                                                                                         |
| Reload on `expired`                                                  | The same screen with extra caution about funds already sent                                                                                                                                                                                              | After a reload the page does not know what happened before ([ADR 0005](docs/adr/0005-resume-from-url-reference.md))                                                                                            |
| Open `?payment=AQH-000000-PMT`, a reference the server does not know | Back to the picker with "We couldn't find that payment"                                                                                                                                                                                                  | The server is asked, and its 404 is an answer, not an outage. Restarting `npm run dev` empties the mock and ends an open payment the same way, but Vite then reloads the page, which usually clears the notice |
| ETH on Ethereum                                                      | All eighteen decimal places, on screen and in the clipboard                                                                                                                                                                                              | Amounts are strings from the API to the wallet                                                                                                                                                                 |
| Hide the tab for two minutes on a live quote                         | The countdown is right when you come back                                                                                                                                                                                                                | It is recomputed from the deadline, never counted down                                                                                                                                                         |

## What I dropped

Each of these is deliberate. The design doc's follow-ups section has the detail.

| Dropped                                                     | Why this, and not something else                                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Payment links in the QR that prefill the amount and network | A token link needs the token's contract address, which the API does not return. Guessing one risks pointing a shopper at the wrong token. The QR holds the plain address, and the page names the network around it |
| An endpoint that returns the order before a payment exists  | The picker's header comes from an assumed order summary, the way the order id already did. I did not invent an API for it                                                                                          |
| A progress bar under the countdown                          | It is in my own drawing. A bar needs the quote's full lifetime, and the API gives only its deadline                                                                                                                |
| Checking every poll against the shopper's choice            | The page checks the answer to a create or a new quote against the choice. A later poll would need the choice to survive a reload                                                                                   |
| A new quote after a partial payment has expired             | The page would have to say what happens to the money already sent, and it does not know                                                                                                                            |
| A live readout of the mock's state in the dev panel         | It needed a polling loop to show what the checkout page beside it already shows                                                                                                                                    |
| A mock script that advances a payment by itself             | The status buttons already reach every state, in any order                                                                                                                                                         |
| A browser end-to-end test suite                             | The unit and hook tests cover what the brief scores. Every state was walked in a real browser against the list in [`docs/plan.md`](docs/plan.md), Task 14, instead                                                 |
| Remembering the status history across a reload              | The brief puts persistence out of scope. I kept the one part that protects a payment in flight, the reference in the URL                                                                                           |
| Fees in the order's currency, dark mode, translations       | None changes whether a shopper pays safely                                                                                                                                                                         |

## Working with the agent

I used Claude Code throughout. One Claude model handled design, planning and coordination, a second wrote the code, and OpenAI's Codex reviewed as an outside opinion.

- **Design first, one decision at a time.** Before any code, the planning agent read the brief and raised each decision with options and a recommendation. I chose. That conversation produced the design doc, the ADRs and `AGENTS.md`.
- **A plan, then one task per agent.** Thirteen build tasks, and one more I added after seeing the finished page, each built test-first by a fresh agent that saw only its own task and the design.
- **A second model reviewed everything.** Codex reviewed the design, the plan, and every task's commit before the next task began, then the whole branch at the end. The planning agent read each diff and re-ran the tests itself. That last pass found the largest gap: nothing checked that a server answer was about the payment the page had asked for.
- **Nothing rewritten.** Review fixes are new commits. The history shows the wrong turns.

[`docs/agent-log.md`](docs/agent-log.md) records every disagreement and mistake at the time it happened. The three answers below are drawn from it.

### Three things the agent wrote that I threw away

1. **Correcting the countdown from the server's `Date` header.** The agent recommended it and designed a fallback chain for when the header is missing. Once we listed where that breaks (unreadable across origins without an extra header, optional on a 5xx, stale when cached), it was a lot of machinery for a number that is only information. The server's status decides expiry either way, so the countdown uses the device clock. ([ADR 0001](docs/adr/0001-server-decides-expiry.md))
2. **An order endpoint in the mock.** The agent drew the first screen with the merchant name and "You pay €149.90", and I approved the drawing. Neither value exists before a payment does. The agent noticed later and proposed adding an endpoint to the mock to supply them. I refused: we had declined to invent API everywhere else. The first screen went without them for the whole build. At the end I put the header back another way: the page already assumed it is handed an order id, so it now assumes the rest of the order summary arrives with it, for display only. No endpoint was invented.
3. **The first double-click guard.** The agent's guard against a second "Continue" was released the moment the first request finished. That is a few milliseconds before React re-renders, and a click in that gap would have created a second payment. The implementing agent flagged it in its own report, without being able to reproduce it, and Codex rated it a blocker. It was replaced by a guard that holds until the result is on screen.

### One place I did it my own way, and the code got better

To tell "expired" from "expired after a partial payment", the agent proposed remembering one fact: that money had arrived. I asked for the full sequence of statuses the page has seen, with the amounts that came with each.

That sequence ended up carrying most of the safety rules. It is how the page knows not to show the address again when a status goes backwards. It is how the failed screen can say "we saw your payment". It is how the page knows, after a reload, that its own history is incomplete and words things more carefully. A single flag could not have done any of those.

### What the agent got wrong about the payment state machine

- **It would have locked out shoppers with a fast clock.** The agent first proposed hiding the address the moment the countdown reached zero. That was fine while the clock was going to be corrected from the server. After I chose the device clock, the same rule meant a shopper whose clock runs ahead would never see an address. The agent caught this itself when the clock decision changed.
- **It let a status go backwards.** As first designed, `detected` followed by `awaiting_payment` brought the address back, which invites a second payment if the first answer was stale. Codex caught it in the design review.
- **Its rule for "expired after money" had a hole.** The rule looked only at the status straight before `expired`. Money, then a status the page does not know, then expiry, gave the screen that offers a new quote. The implementing agent built the rule as written and then pointed out what it let through.
- **Polling did not quite stop.** After `paid`, the timer stopped, but returning to the tab, reconnecting or pressing "Try now" each still sent a request. The plan's own settings caused it.
- **The check at zero could go to the wrong place.** When a payment was created on a device whose clock runs far ahead, the pay screen was past its deadline on its first render, and its check ran before the polling hook had switched to the new payment. The shopper saw the right screen; the browser console showed a library error. No test and no review found it. Driving the real page through every state did.
- **It stated a library's behaviour from memory.** ADR 0002 said the polling interval was fixed-rate. The tests showed the library restarts its timer after every answer. The ADR is corrected, and says it was corrected.
- **The brief's own count.** The brief says there are "six more states" beyond the four in its diagram. The API defines four more. I noticed that before the agent read the brief, so it did not get the chance to miscount.

I also changed my own mind once because of a review. I had decided a partial payment would still expire at the quote's deadline. Codex read the brief's line, that a payment on its way must never expire under the shopper, as covering a partial payment, and it was right. [ADR 0003](docs/adr/0003-partial-and-late-payments.md) records how that decision moved.
