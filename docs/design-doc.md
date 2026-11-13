# Stablecoin Checkout: design doc

**Status:** written before the build on 12 Nov 2026, revised the same day after two reviews, and revised again after the build so that it describes what exists. Where the build departed from the first design, the text says so. The decisions with a real trade-off are in [`adr/`](adr/). This document and the ADRs are the current specification; the plan, the log and the drawings are records of how the work went, and [`docs/README.md`](README.md) says which is which.

**Diagrams in this document.** Each is shown in the section it explains. The six SVG files are in [`diagrams/`](diagrams/).

| Diagram | What it shows | Section |
|---|---|---|
| [Lifecycle](diagrams/lifecycle.svg) | The eight statuses, grouped by what the shopper can do, and the transitions expected between them | [3.2](#32-state-chart) |
| [From a status to a screen](diagrams/status-to-screen.svg) | The inputs to `deriveScreen`, the screens it can return, and where the notice strip comes from | [3.4](#34-from-status-to-screen) |
| [The three expired screens](diagrams/expired-three-screens.svg) | How the statuses seen before decide which `expired` screen appears | [3.5](#35-the-status-sequence) |
| Components and data flow | Every part of the system, including the mock and the dev panel. Drawn in the text | [4](#4-component-structure-and-data-flow) |
| [How the hooks interact](diagrams/hook-interaction.svg) | What each hook passes to the next | [4](#4-component-structure-and-data-flow) |
| [Polling cadence](diagrams/polling-cadence.svg) | When the page asks the server, to scale over one minute | [4.4](#44-polling) |
| [What happens at zero](diagrams/countdown-at-zero.svg) | The pay screen's states when the countdown ends | [5](#5-how-the-countdown-stays-correct-when-the-tab-is-in-the-background) |

## 1. What this is

A hosted payment page. A shopper who chose "Pay with crypto" picks a currency and a network, gets a quote (an exact amount, an address, a QR code and a countdown), sends the money from their own wallet, and the page follows the payment until the server reports a final result.

The page cannot see the blockchain and does not control the outcome. It reports what the server says. That shapes most of the design: the page holds very little state of its own, and every screen is derived from the server's last answer.

**What I optimised for, in this order:**

1. The network is impossible to miss. The page cannot make a wrong-network send impossible, because the QR carries no network ([ADR 0004](adr/0004-qr-holds-address-only.md)), so the labelling has to do that work.
2. The page never expires or hides a payment that is on its way.
3. Every screen tells the truth, including the uncomfortable ones (overpaid, failed).
4. No digit of an amount is lost or invented.

**Not in scope:** auth, real wallets or chains, a merchant dashboard, translations, pixel-perfect design, dark mode. Browser end-to-end tests are a follow-up (section 10).

**What would make this a failure even if it works:** a quote that expires while money is on its way, an address shown without its network, a promise the API does not back (a refund), float maths on money, or code I cannot explain a week later.

## 2. The flow

The page has three screens inside one card. The picker is one column. Once there is a payment, the card keeps one shape: the payment's facts on the left, what is happening and what to do on the right, and a strip along the bottom for notices.

| Screen | When | Agreed design |
|---|---|---|
| Picker | No payment exists yet | [`design/picker-proposal.png`](design/picker-proposal.png) |
| Pay | `awaiting_payment`, `underpaid`. A card with the order header and a loading line stands in for it until the payment's details have been checked against the currency list (section 6) | [`design/pay-screen-proposal.png`](design/pay-screen-proposal.png) |
| Status | Every other status | [`design/status-screens-proposal.png`](design/status-screens-proposal.png) |

![Pay screen](design/pay-screen-proposal.png)

The drawings are the designs I agreed before the build, and they are kept as agreed. The build has moved away from them in four rounds. Two things changed while building: the bar under the countdown is drawn only when the page saw the quote begin, and not after a reload (section 5), and the dev panel has no live readout (section 8). Five changed when I went over the finished screens: the picker has the same header as the pay screen, with the merchant and the amount, and no line about the clock under it, the pay screen has no hint about exchange withdrawal fees, the expired screen has no address row, and the failed screen has no line under the card (section 11). One was added later: the dev panel has a Start over section and slides open and closed (section 8). After the build, a review of the rendered page changed the look of every screen and none of its words: sizes, colours and corners come from one small set, the status marks are drawn and not typed, and a few things fade in (section 11.1). Last, I chose a different picker and the chains' own colours from a second set of drawings, which are not in this folder: the picker is two sections of radio buttons in one narrow card, where the drawing above has two menus and a right-hand column, and the pay screen's banner and QR frame are in the chain's colour (section 11.2).

**Choose first, then quote.** The page opens on the picker with nothing selected. No payment exists and no clock runs. Only when the shopper presses "Continue with USDT on Tron" does the page call `POST /api/payments` and show an address.

I chose this over creating a quote on landing with a default currency, for two reasons. A default puts an address on screen for a network the shopper never chose, which is the mistake the brief warns about. And a clock that starts before the shopper has decided adds pressure to the one choice that can lose their money.

The API forces part of this. `POST /api/payments/:reference/requote` returns 409 unless the quote has already expired, so a change of network while a quote is live cannot be a requote. It has to be a new `POST /api/payments`, which creates a new payment with a new reference and leaves the old address live.

**Changing the choice:**

- **While the quote is live** (`awaiting_payment`, with its address on screen): "Change currency or network" asks for confirmation first, because a payment sent to the old address after the change would not be tracked on this page. If the shopper confirms they have not sent anything, the page returns to the picker and the next choice creates a new payment. The confirmation cannot rule out a transfer started on another device a moment earlier. I accept that, because the alternative is to make a shopper who picked the wrong network wait for the quote to expire before they can correct it. The button is not offered while the address is hidden at the deadline.
- **After the quote expired with no money seen:** the same button returns to the picker, and the next choice calls requote on the same reference. Requote takes a currency and a network, so it can change both. No payment is abandoned, and the page keeps polling the payment while the picker is open, in case a late payment arrives.
- **While a status that carries money is showing** (`underpaid`, `detected` and later): there is no way to change. The remainder goes to the address the `underpaid` answer carries, on the same network. Section 3.4 has the one case where a quote that saw money can still be replaced: its status went back to `awaiting_payment` and then it expired.
- **If the server ends a partial payment** (`expired` straight after `underpaid`): there is no change and no new quote. The page sends the shopper to the merchant ([ADR 0003](adr/0003-partial-and-late-payments.md)).

**The order summary on the picker.** The API returns the merchant name and the order amount only inside a payment, and when the picker first opens no payment exists. The page already assumed it is handed an order id by whatever sent the shopper here. It now assumes the rest of the order comes with it: an order summary of `{ order_id, merchant, order }`, in the same shape a payment carries them. The build keeps that object as a constant in `src/config` and uses it for display only, so the picker has the same header as every later screen. Nothing in it is sent to the API except the order id. Once a payment exists, the header shows that payment's own values, not the assumed ones. I did not add an order endpoint to the mock for this; see section 9.

**Refresh.** After a payment is created, its reference goes in the URL (`?payment=AQH-100306-PMT`). On load, a reference in the URL makes the page fetch that payment and resume on the right screen. The page replaces the current history entry instead of adding one, so Back does not walk through earlier payments. This departs from the brief, which lists persistence as out of scope; the reasoning is in [ADR 0005](adr/0005-resume-from-url-reference.md).

## 3. The payment lifecycle state model

### 3.1 Eight statuses

`GET /api/payments/:reference` defines eight statuses: `awaiting_payment`, `detected`, `confirming`, `paid`, `underpaid`, `overpaid`, `expired`, `failed`.

The brief's lifecycle diagram shows four and says "there are six more". The API section defines four more, not six, so I built for eight and listed this as an open question (section 9).

### 3.2 State chart

![State chart of the eight payment statuses, grouped by what the shopper can do: your move, wait, final. Solid arrows are the transitions expected from a real server; dashed arrows are rare ones the page allows for.](diagrams/lifecycle.svg)

The three shaded groups are the ones section 3.3 describes. A dot marks the two statuses where the address and QR can be on screen.

These are the transitions I expect from a real server. **The page does not enforce them.** It renders whatever status the server reports, in any order, because the server is the only party that knows what happened on chain. The dev panel can set any status at any time, and the page has to cope with every order.

There is one exception, and it only ever hides something. Once money was seen for a quote, a later `awaiting_payment` does not bring the address back (3.4).

### 3.3 Three groups: what the shopper can do

The brief asks which states the shopper can still fix. I sort the statuses by what the shopper can do, and each group looks different.

| Group | Statuses | What the shopper sees | Action |
|---|---|---|---|
| **Your move** | `awaiting_payment`, `underpaid`, `expired` | Something to do, stated once | One main action. Section 3.4 has the two cases where what the page saw before takes it away: `awaiting_payment` after money was seen, and `expired` after money was seen |
| **Wait** | `detected`, `confirming` | Progress, and "You don't need to send anything else." | None. The address and QR are gone so nobody sends twice |
| **Final** | `paid`, `overpaid`, `failed` | The result | None |

Fixable problems are `underpaid` (send the rest) and `expired` when no money was seen (get a new quote). They carry one clear action each. The problems the shopper cannot fix are `failed`, the extra money in `overpaid`, and a quote that expired after a partial payment. Those screens have no button at all, so nothing looks like a fix that is not one. They give the shopper the reference and the merchant's name to take away, with the amounts and the transaction hash whenever the page has them.

### 3.4 From status to screen

The screen is the output of one pure function, `deriveScreen`. Its inputs are the server's latest answer, the sequence of statuses seen (3.5), the time, the times of the last answer and of the last failed request, and whether the payment's details have been checked against the currency list (section 6). The time is the later of the device clock and the moment the last answer arrived (section 5). The connection notice is derived separately, by `deriveConnection`, from whether the browser is online and how many polls in a row have failed.

![Five inputs feed the pure function deriveScreen: the server's latest answer, the statuses seen so far, the time, the times of the last answer and the last failed request, and the details check. It returns one of seven screens. Separately, the browser's online state and the number of failed polls in a row give the notice strip laid over any screen.](diagrams/status-to-screen.svg)

The rows for `awaiting_payment` are in the order the function checks them.

| Server status | Condition | Screen | Address and QR | Countdown | Poll |
|---|---|---|---|---|---|
| `awaiting_payment` | money was already seen for this quote | "We're checking your payment" | hidden | none | 3 s |
| `awaiting_payment` | details not checked yet: the currency list is still loading | Loading card, "Loading the payment details…" | hidden | none | 3 s |
| `awaiting_payment` | details could not be checked, or failed the check | Loading card, "We couldn't load the payment details." with "Try again" | hidden | none | 3 s |
| `awaiting_payment` | time left on the device clock | Pay | shown | shown | 3 s |
| `awaiting_payment` | past the device's deadline; the last answer arrived after it and is no more than 10 s old | Pay, "This quote is still valid. Your device clock looks wrong, so the timer is hidden." | shown | hidden | 3 s |
| `awaiting_payment` | past the device's deadline; the last request failed, after the deadline and after the last answer | Pay, "We can't confirm this quote is still live. Don't send until this page reconnects." | hidden | hidden | backing off |
| `awaiting_payment` | past the device's deadline, otherwise | Pay, "Time's up. Checking with the payment service." | hidden | hidden | one check at once, unless an answer has arrived since the deadline; then 3 s |
| `underpaid` | details checked | Pay, the remaining amount | shown | none | 3 s |
| `underpaid` | details not checked | The same loading card as for `awaiting_payment` | hidden | none | 3 s |
| `detected`, `confirming` | | Waiting | hidden | none | 3 s |
| `paid` | | Complete | hidden | none | off |
| `overpaid` | | Complete, with a notice about the extra | hidden | none | off |
| `expired` | the last status the page knows before it carried money | Expired after money was seen, a dead end | hidden | none | 15 s |
| `expired` | otherwise, and the sequence started from a reload | Expired, cautious wording | hidden | none | 15 s |
| `expired` | otherwise | Expired | hidden | none | 15 s |
| `failed` | money seen, not seen, or unknown | Failed, in three wordings | hidden | none | off |
| anything else | | "We're checking your payment" | hidden | none | 3 s |

Connection trouble is not a row in this table. It is a notice in the strip, laid over whichever row applies (section 7).

**A status that goes backwards.** If `awaiting_payment` follows `detected`, `confirming` or `underpaid` on the same quote, the page cannot tell which of two things happened. Either the answer is stale and the money is there, or the transaction was dropped and the shopper does need to pay again. Showing the address would be right in the second case and would invite a double payment in the first. So the page shows "We're checking your payment", with "Don't send again." under it, and keeps polling. An address comes back only with a new quote, or with an `underpaid` answer that asks for the rest. In the dropped-transaction case the shopper waits for the quote to expire and then gets a new one: `expired` straight after `awaiting_payment` is the plain expired screen, where a new quote sits behind the "I have not sent a payment" tick box. A delay can be recovered from, and a double payment cannot.

A review argued that this last step should be a dead end too, because the page did see money for that quote. I kept the new quote so that a dropped transaction can be recovered on this page. It is a known limit, and making "money was seen" permanent for a quote is a follow-up (section 10).

### 3.5 The status sequence

Some screens depend on what happened before. `expired` straight after `underpaid` must not offer a new quote, because the shopper already sent part of the money and the API does not say what happens to it. The `expired` response itself carries only `expired_at`.

So the page keeps the sequence of statuses it has seen for a payment, each with the fields that came with it (amount received, amount outstanding, transaction hash). It is stored beside the payment in the query cache and appended in the one function where a server response becomes cached data. Polls and requotes both pass through that function, so there is no effect to keep in sync and no second store.

Its rules:

- A repeated status updates the last entry instead of adding one.
- "For this quote" means the entries since the last creation or requote. A partial payment on an earlier quote does not change the wording for a later one.
- The sequence records whether it started at creation or from a reload. After a reload the page cannot know whether money arrived earlier, so both screens add a cautious sentence. On `expired`: "If you sent any funds for this payment, do not get a new quote. Contact Nordwind Audio." On `failed`: "If you sent any funds for this payment, tell Nordwind Audio." If a resumed sequence later sees money, `failed` says so in place of that sentence, and `expired` follows the rule in 3.4: the last status the page knows before it decides.
- `failed` carries only a reason and `expired` only a time. What was received and what is missing on those screens come from the sequence. The quote's `total_due` appears only as the amount that was due: "Expired quote" on the plain expired screen and "Amount due" on the dead end.

How the sequence decides which `expired` screen appears:

![When the server says expired: if the last status the page knows before it carried money, the screen is a dead end. Otherwise, if the page's history started at a reload, it uses cautious wording. Otherwise it is the plain expired screen.](diagrams/expired-three-screens.svg)

### 3.6 Unknown statuses

A status the page does not know is not a validation error. The schema accepts any status string, and an unknown one maps to a safe screen, headed "We're checking your payment", which says "Don't send again." Polling continues. The screen also shows the payment reference with a copy button and says to contact the merchant if it does not change, so a status that never resolves still leaves the shopper a way forward.

In code, the known statuses are one discriminated union and the screen function switches over it exhaustively. Adding a ninth status fails to compile until every place handles it. Each screen is handed the payment already narrowed to the statuses that can produce it, so a screen cannot read a field its status does not have.

### 3.7 When polling stops

Polling stops on `paid`, `overpaid` and `failed`. After one of those, or after the server says it does not know the payment, the page sends no request of any kind: not from the timer, the tab returning, a reconnect or "Try now".

It does **not** stop on `expired`, which the brief might count as terminal. A shopper who sent in the last seconds can be told "expired" before the server sees their money. If the page stopped there, it would invite a second payment while the first is in flight. So `expired` keeps polling, more slowly, until the shopper gets a new quote, and the screen says "Already sent? Do not send again. We are still watching for your payment." The trade-off is in [ADR 0003](adr/0003-partial-and-late-payments.md).

## 4. Component structure and data flow

```mermaid
flowchart LR
    URL["URL: order_id, payment"] --> UC["useCheckout"]
    CFG["src/config: assumed order summary"] --> UC
    UC --> PK["PickerScreen"]
    UC --> PV["PaymentView"]
    UC --> UP["usePayment: poll + status sequence"]
    UP --> PS["usePaymentScreen"]
    PV --> PS
    NOW["useNow: device clock, while a quote is live"] --> PS
    ON["useOnline: connection"] --> PS
    CUR["useCurrencies"] --> PS
    PS --> DS["deriveScreen (pure)"]
    DS --> SC["Pay, loading and status screens"]
    PS --> DC["deriveConnection (pure)"]
    DC --> NS["Notice strip"]
    PK -- "choice" --> UC
    SC -- "new quote" --> UC
    UC -- "create, requote" --> API
    UP <--> API["src/api: fetch, timeout, zod"]
    CUR <--> API
    API <--> MOCK["Express mock: /api"]
    DP["DevPanel"] <--> CTRL["Express mock: /__mock"]
```

Data moves one way. A server response is validated, stored in the query cache with the status sequence, turned into a screen by a pure function, and rendered. Shopper actions go back out through `useCheckout` as two writes, create and requote, whose responses re-enter by the same path.

The same flow at the level of the hooks, with what each one passes to the next:

![How the hooks pass data. The URL gives useCheckout the payment reference, and useCheckout hands it to usePayment, which polls the API and keeps the payment and its status sequence in the query cache. usePaymentScreen receives that entry with the clock from useNow, the connection from useOnline and the currency list from useCurrencies, passes its inputs to deriveScreen, and PaymentView shows the screen that comes back. PickerScreen sends the shopper's choice to useCheckout, which creates or requotes. One dashed arrow goes back up: usePaymentScreen asks usePayment to check once at zero.](diagrams/hook-interaction.svg)

In `App.tsx`, `Page` calls `useCheckout` and `Checkout` calls `useCurrencies`, and their results go down as props, which is why `usePaymentScreen` receives the poll result instead of calling the polling hook itself. Six more hooks each serve one screen or component and talk to no other hook: `usePickerChoice`, `useDelayedFlag`, `useFocusOnChange`, `useCopy`, `useModalDialog`, and `useMockSettings` in the dev panel.

### 4.1 Layers

| Folder | Holds | Rule |
|---|---|---|
| `src/api` | Request functions, timeouts, zod schemas | The only code that talks to the payment API or validates a response's shape |
| `src/domain` | Status groups, `deriveScreen` and `deriveConnection`, the status sequence, countdown maths, the decimals check, the check of a payment against the currency list (`detailsMatch`), and the amount and address to pay (`toSend`) | Pure functions, no React, no I/O |
| `src/hooks` | `useCheckout`, `usePayment`, `usePaymentScreen`, `useCurrencies`, `useNow`, `useOnline`, and small ones for the picker's selection, copying and the dialog. The URL reader and the payment cache helpers sit beside the hooks that use them | Own all behaviour and timing |
| `src/screens` | Whole checkout screens: `PickerScreen`, and `PaymentView`, which shows one of `PayScreen`, `WaitingScreen`, `CompleteScreen`, `ExpiredScreen`, `FailedScreen` or `CheckingScreen`, or the shared loading card while a payment's details are being checked. Each screen receives the payment narrowed to the statuses that can produce it. Also the wording those screens share | Render only. A screen is one state of the checkout and is used once |
| `src/components` | The pieces screens are built from: the card, the status card, the loading card, the order header, the copy button, the network banner and chip, the QR frame, the notice strip, the change dialog, the picker's collapsible section, the function that gives a network its colours, and three reused across screens: the button, the notice box and the status icon | Render only, and do not know which screen they are in. A screen or a component may keep view state that nothing else reads, such as a ticked box or an open dialog |
| `src/config` | The assumed input the page starts with: the order summary it is handed before a payment exists | For display, apart from the order id, which is sent when a payment is created. Once a payment is loaded, its own values are the authority for what the header shows |
| `src/dev` | The dev panel and its own small request helper | The only code that knows the mock exists. It calls the mock's control endpoints itself and never goes through `src/api` |
| `src/test` | Fixtures and helpers the tests share | |
| `mock/` | The Express app, fixtures, control endpoints | |

Screens and components are both rendering code, and the split between them is by reuse, not by importance. Behaviour stays in hooks and decisions stay in `src/domain`, whichever folder draws the result.

The folders took this shape in Task 16 of the plan, after the build. Before it, the screens lived in `src/components`, `PickerScreen` was called `Picker`, and the assumed order sat in `src/hooks/url.ts`. Older plan tasks and log entries name files where they were at the time.

### 4.2 State

| State | Lives in | Why |
|---|---|---|
| Payment, currencies, status sequence | TanStack Query cache | It is server data, or derived from it at the boundary |
| Selected currency and network | React state in `usePickerChoice` | It belongs to the picker and nothing else reads it |
| Whether the picker is open for a new quote, a write in progress and its error | React state in `useCheckout` | It belongs to one screen tree and nothing outside React reads it |
| Payment reference, and the order id when `?order_id=` is given | React state in `useCheckout`, read from the URL when the page loads. The reference is written back to the URL when it changes | So a refresh resumes. Without the parameter, the order id is the assumed one |
| The order summary shown before a payment exists | A constant in `src/config/checkout.ts` | It stands for data handed to the page. Apart from its order id, which is sent when a payment is created, it is for display, and the payment's own values replace it once a payment exists |
| A ticked box, an open dialog, which picker section the shopper reopened | React state in that component | View state that nothing else reads |
| The open dev panel | React state in the panel, copied to `sessionStorage` | So it is still open after the reload its Start over buttons cause |
| Which screen to show, connection notice, time left | Not stored | Derived on every render |

There is no state library and no state machine library. A client state machine would model transitions the page does not own: the server drives every one of them, and the page only maps the latest answer to a screen.

### 4.3 Requests

Reads retry themselves. Writes ask the shopper. The API has no idempotency key, so a retried create makes a second payment. That is harmless to the shopper, who never saw its address, but creating payments silently would hide a failing server.

| Request | Slow response | Failure | Retry |
|---|---|---|---|
| `GET /api/currencies` | Loading state, give up at 10 s | Full-card error | Automatic, two more tries with backoff, then "Try again". Until the list arrives, it also asks again when the tab regains focus or the connection returns |
| `POST /api/payments` | Progress on the button, "still working" after 4 s, give up at 10 s | Error beside the button, choices intact | Manual only |
| `GET /api/payments/:ref` | Give up at 10 s, counts as a failed poll | Last status stays, notice after two failures in a row | The next poll is the retry |
| `POST …/requote` | From the picker, as for create. From the expired screen's button, the button reads "Working…" at once and there is no later hint. Give up at 10 s | Error where it was pressed: on the expired screen, or beside the picker's button | Manual only, then re-read the payment in case it went through |

Further rules:

- One create is in flight at a time, and the picker's radio buttons and "Change" buttons are disabled while it is.
- A 4xx with a problem body is an answer, not an outage. The currency list and the two writes do not retry it. For the payment poll only a 404 ends polling; any other failed answer counts as a failed poll, and the next poll asks again on the backed-off interval.
- A requote that returns 409 `quote-not-expired` makes the page re-read the payment and show what the server says.
- A response that fails validation counts as a failed request.
- An answer must be about what was asked. A payment with another reference, another order or another pair than the request named is rejected in the same way as a malformed one. The whole-branch review found this missing; section 9 states the one case it cannot cover.
- Every API request bypasses the HTTP cache (`cache: 'no-store'`), and the mock sends `Cache-Control: no-store`. A cached `awaiting_payment` must never stand in for a fresh one.

### 4.4 Polling

Polling uses TanStack Query's own interval on one query per payment reference. The interval is a function of the last result: 3 s while active, 15 s on `expired`, off on final statuses. While requests fail it grows: it is the larger of the status's own interval and 3 s doubled for each failure in a row, capped at 30 s. On an active status that gives 6, 12, 24 and then 30 s. On `expired` it gives 15, 15, 24 and then 30 s.

![Polling over one minute, to scale: every 3 seconds on active statuses, every 15 seconds on expired, gaps of 6, 12, 24 then 30 seconds while requests fail on an active status, and nothing after a final status or a not-found answer.](diagrams/polling-cadence.svg)

- The library's built-in retries are off for this query, because the next poll is the retry.
- A hidden tab pauses polling. One poll fires as the tab returns.
- There is one query per payment reference, and every trigger goes through it: the interval, the tab returning, the check at zero and "Try now". A trigger that fires during a request joins that request instead of starting another.
- Starting a requote waits for the poll in flight to be cancelled before it sends, and cancels again just before it writes the answer. A poll that was running, or one that started during the requote, cannot overwrite the fresh quote with an older "expired" answer.
- Unmounting, or switching to another payment, aborts the request in flight and clears the timer.

The guarantee that two polls never overlap comes from the library: a query has at most one request in flight, and an interval tick that lands during a request joins it. I rely on that and prove it with tests that fire every trigger against a response slower than the interval. The alternative, a hand-written loop, is weighed in [ADR 0002](adr/0002-polling-with-tanstack-query-interval.md).

### 4.5 The API as the brief gives it

Four endpoints. Every amount is a decimal string.

| Endpoint | Request body | Response |
|---|---|---|
| `GET /api/currencies` | | `{ currencies: [{ code, name, decimals, networks: [{ id, name, network_fee, required_confirmations, avg_confirmation_seconds }] }] }` |
| `POST /api/payments` | `{ order_id, currency, network }` | 201 with a payment |
| `GET /api/payments/:reference` | | The payment, its current status, and that status's fields |
| `POST /api/payments/:reference/requote` | `{ currency, network }` | 201 with the same reference, a new quote and `awaiting_payment`, or a 409 |

The mock adds three answers the brief does not define, in the same problem format: 404 `payment-not-found` for a reference it does not know, 422 `invalid-request` for a malformed body or a pair that is not offered, and 500 `internal` when the dev panel's fault is switched on.

A payment, as returned by create:

```json
{
  "payment_reference": "AQH-100306-PMT",
  "order_id": "ORD-88213",
  "status": "awaiting_payment",
  "merchant": { "name": "Nordwind Audio", "logo_url": null },
  "order": { "currency": "EUR", "amount": "149.90" },
  "quote": {
    "crypto_currency": "USDT",
    "network": "tron",
    "network_name": "Tron (TRC-20)",
    "exchange_rate": "0.9214",
    "crypto_amount": "162.69",
    "network_fee": "1.00",
    "total_due": "163.69",
    "crypto_address": "TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e",
    "required_confirmations": 1,
    "expires_at": "2026-08-14T08:52:10.842Z"
  }
}
```

The fields each status adds:

| Status | Fields |
|---|---|
| `awaiting_payment` | none |
| `detected` | `confirmations`, `required_confirmations`, `amount_received`, `tx_hash`, `detected_at` |
| `confirming` | `confirmations`, `required_confirmations`, `amount_received`, `tx_hash` |
| `paid` | `confirmations`, `required_confirmations`, `amount_received`, `tx_hash`, `settled_at` |
| `underpaid` | `amount_received`, `amount_outstanding`, `crypto_address`, `tx_hash` |
| `overpaid` | `amount_received`, `amount_excess`, `tx_hash`, `settled_at` |
| `expired` | `expired_at` |
| `failed` | `reason` |

The six currency and network pairs in the catalogue:

| Currency | Decimals | Network (`id`) | `network_fee` | Confirmations | Usual seconds |
|---|---|---|---|---|---|
| USDT | 6 | Tron (TRC-20) (`tron`) | `1.00` | 1 | 60 |
| USDT | 6 | Ethereum (ERC-20) (`ethereum`) | `4.50` | 3 | 180 |
| USDC | 6 | Ethereum (ERC-20) (`ethereum`) | `4.50` | 3 | 180 |
| USDC | 6 | Polygon (`polygon`) | `0.10` | 6 | 30 |
| USDC | 6 | Solana (`solana`) | `0.01` | 1 | 15 |
| ETH | 18 | Ethereum (`ethereum`) | `3.20` | 3 | 180 |

Errors are `application/problem+json` with `type`, `title`, `status` and `detail`. The brief defines one: requote returns 409 with type `https://developers.triple-a.io/errors/quote-not-expired`.

## 5. How the countdown stays correct when the tab is in the background

**It is never a counter.** The page does not subtract one each second. Every tick recomputes `expires_at` minus the device clock. A browser throttles or suspends timers in a hidden tab, so a counter would fall behind by however many ticks it missed. A recomputed value cannot drift: the first tick after the tab returns shows the right time, whether the tab was hidden for two minutes or the laptop slept for an hour. The time is rounded up to the next second, so `0:00` appears only when no time is left.

**The clock runs only while it can matter.** Time is read in one status, `awaiting_payment`: for the countdown, for hiding the address at the device's deadline, for the ten-second window in the table below, and for the one check sent at that deadline. In every other status the page has no timer at all. The time a screen is derived from is the later of the ticking clock and the moment the last answer arrived, and a stopped clock has no value. So a new quote starts from the time of the answer that brought it and cannot inherit an old reading, even if the device clock was set back in between.

Measured in the running app with temporary counters, as commits of the payment view in ten seconds:

| Status | Polls in that time | Before | After |
|---|---|---|---|
| `awaiting_payment` | 3 | 13 | 13 |
| `underpaid`, `detected`, `confirming` | 3 | 13 | 3 |
| `paid`, `overpaid`, `failed`, `expired` | 0 | 10 | 0 |

Before, ten of the commits in every row came from the clock. After, the clock accounts for commits only on `awaiting_payment`, and everything else is a poll answer arriving.

**A bar under the time, when the page saw the quote begin.** The agreed drawing has a progress bar under the countdown. A bar needs the quote's full lifetime, and the API gives only its deadline, so the first build showed the time alone. I asked for the bar back. The page now notes the device time at which it first sees a quote, when it creates the payment or gets a new quote, and draws the time left as a share of the time between that moment and the deadline. After a reload it has no such moment, so it shows the time alone until the next quote. The bar is decoration: the number beside it is the information.

**The tab returning is an event.** When the tab becomes visible again, the page recomputes at once and polls at once, so the shopper never acts on a stale screen.

**The countdown is information, not authority.** It uses the device clock, which can be wrong. Only the server's status can end a quote:

| What happens | What the page does |
|---|---|
| The device clock passes the deadline | Hides the address, the QR and the timer, shows "Time's up. Checking with the payment service.", and asks the server once |
| Server says `expired` | Shows the expired screen. Section 3.4 decides which of its three forms, and so whether a new quote is offered |
| Server says the quote is still live | Brings the address back, hides the timer, shows "This quote is still valid. Your device clock looks wrong, so the timer is hidden." The device clock is known to be wrong, so the page stops showing a number it cannot trust |
| The deadline has passed on this device and the server has already answered since | Does not ask again. The answer in hand is newer than the deadline, and the next poll follows as usual |
| No timer, and the server has not answered for 10 s | Hides the address until a fresh answer arrives. This covers the tab returning from the background and polls that start failing |
| The check fails | Keeps the address hidden and says "We can't confirm this quote is still live. Don't send until this page reconnects." |
| Server says `expired` while the countdown still shows time | Shows the expired screen. The server wins |
| Server says `underpaid`, `detected` or later | The countdown is gone for good |

Without a timer the page has no local deadline to rely on, which is why the untimed state depends on a recent answer from the server.

![While the server says awaiting_payment, the pay screen has four states: counting down, time's up and checking, quote still valid, and can't confirm. An expired answer from the server at any point leads to the expired screen.](diagrams/countdown-at-zero.svg)

After ten seconds without a fresh answer the address hides again: as "checking" while the page only waits, and as "can't confirm" if a request has failed since the last answer. The figure shows the four states of the pay screen itself. The loading card and the "We're checking your payment" screen of 3.4 are also possible on `awaiting_payment`, are decided before the clock is looked at, and are not drawn.

The clock errors behave differently, and I accept all three:

- **Device clock ahead:** the countdown ends early, the check finds the quote still live, and the shopper can still pay. Without the "still live" rule, a shopper whose clock runs far ahead could never pay.
- **Device clock behind:** the countdown shows more time than the server allows. The page corrects at the first poll after the server expires the quote. This is the real cost of using the device clock, and the late-payment polling on `expired` softens it.
- **Device clock behind, during an outage:** the address stays visible until the device's countdown reaches zero, and the real deadline can pass first. This needs both failures at once, and I accept it rather than hide a valid quote from everyone whose connection drops for a minute.

I considered correcting the clock from the server's `Date` header and chose not to. The reasoning is in [ADR 0001](adr/0001-server-decides-expiry.md).

**Any money stops the clock.** The countdown exists only on `awaiting_payment`. Once the server reports money, whether the full amount or part of it, there is no countdown and nothing on this page can expire the payment. A shopper who sent part can always send the rest. The cost is that the rate stays open for the remainder; the reasoning, and how I changed my mind on it, is in [ADR 0003](adr/0003-partial-and-late-payments.md).

## 6. How I handle decimal precision

The rule is that no digit of an amount is lost or invented between the API and the shopper's wallet. USDT has 6 decimal places and ETH has 18, and a JavaScript `number` holds only about 15 to 17 significant digits.

A real example from the mock's ETH quote, checked in Node:

| | Value |
|---|---|
| Server sends | `0.054229071702481731` |
| Through `Number` | `0.05422907170248173`, the last digit is gone |

**What the page does:**

- **Amounts are strings end to end.** The API sends decimal strings. They get their own string type, created only where a response is validated, so passing one to ordinary maths is a compile error.
- **No maths on money.** The page shows `total_due`, `amount_outstanding` and `amount_excess` as the server sends them. It never adds the fee, subtracts what was received, or rounds.
- **Validation at the boundary.** A response is rejected if an amount arrives as a JSON number or is malformed. A JSON number has already been through a float by the time the page sees it.
- **A decimal-places check before any amount to send is shown.** A crypto amount with more decimal places than its currency's `decimals` allows is never shown as an amount to send. The answer itself is kept, so a screen that only reports a status is not affected. The check needs the currency list, so it is a pure function, `detailsMatch` in `src/domain`, which the screen hook calls with the payment and the list. On `underpaid` it covers both `total_due` and `amount_outstanding`.
- **Crypto is shown exactly as sent.** Dot decimal, no thousands separators, never rounded or shortened, including all eighteen ETH places. The copy button copies that exact string with no unit.
- **Only fiat follows the locale.** The order amount goes to the browser's number formatter as a string, which current browsers format exactly, so a German shopper sees `149,90 €`. A test asserts that a long decimal string comes through the formatter unchanged.
- **No decimal library.** A library would earn its place if the page did arithmetic. It does not.
- **No floats in the mock either.** Its amounts are literal strings in a hand-written table.

I show crypto exactly as sent, not in the shopper's locale, because that number gets retyped or pasted into a wallet. A wallet that expects a dot may reject `163,69`, or read `1.234,56` wrongly. A locale-formatted crypto amount is the one way this page could cause a wrong amount.

**Where `decimals` is used.** `GET /api/currencies` returns each currency's `decimals`. The page uses it for the decimal-places check above and nowhere else. After a reload the currency list has to be fetched again. Until it arrives and the amount has passed the check, a loading card stands in for the pay screen, with the order header and no amount, address or QR. The quote's currency and network must also be in the currency list, under the same network name. If they are not, or an amount fails the check, that card says "We couldn't load the payment details." and offers "Try again". Screens that only report a status do not wait for it, so a payment in flight is never hidden behind the currency list. It would also be needed to build wallet payment links, which the page does not do; see [ADR 0004](adr/0004-qr-holds-address-only.md).

## 7. How I show failure states

![Status screens](design/status-screens-proposal.png)

### 7.1 Four rules for wording

1. **Say only what the API says.** No promised refunds, and no outcomes the response does not state.
2. **A dead end gives the shopper something to take away:** the reference with a copy button and the merchant's name as who to contact, plus the amounts and the transaction hash whenever the page has them. A `failed` payment that never showed money has neither.
3. **A fixable screen has one main action. A dead end has none.**
4. **The page never tells anyone to send again** unless the status calls for it.

### 7.2 The screens

| Status | Headline | What it says | Action |
|---|---|---|---|
| `underpaid` | Part of your payment arrived | What was received, the exact amount still to send, and the address the `underpaid` answer carries, on the same network. No countdown | Send the rest |
| `expired` | This quote has expired | "Already sent? Do not send again. We are still watching for your payment." The address is hidden | "Get a new quote", enabled only after ticking "I have not sent a payment" |
| `expired` after `underpaid` | The full amount wasn't reached | What was received and what was missing. "Do not send again. This page can't complete this payment or tell you what happens to the 120.00 USDT you sent. Contact Nordwind Audio and quote reference AQH-100306-PMT." | None |
| `overpaid` | Payment complete | "You sent 16.31 USDT more than was due. This page can't return the extra amount. Contact Nordwind Audio and quote reference AQH-100306-PMT." | None |
| `failed` | This payment could not be completed | The reason in plain words, the server's reason code in small print, "do not send anything more", contact the merchant | None |
| unknown | We're checking your payment | "Don't send again. If this doesn't change, contact Nordwind Audio and quote reference AQH-100306-PMT." | None |

The tick box belongs to the plain `expired` screen and its cautious reload variant. The partial-payment screen has no tick box, because a shopper who paid part cannot truthfully tick "I have not sent a payment". It is a dead end, with no button and no link to change currency.

Notes on three of them:

- **`overpaid`** is shown as a success with a clear notice, not as plain green and not as an error. The response has a settlement time, so "complete" is true. It says nothing about a refund, so neither does the page.
- **`failed`** is a dead end on purpose. I do not know what a reason such as `settlement_rejected` means for a second attempt, and a retry could leave more money stuck. If the sequence shows money was seen, the screen says so, "We saw your payment, but it could not be completed", and shows the amount beside it.
- **`detected`** says "We've seen your payment on the network", not "received" or "complete". Zero confirmations is not settled.

### 7.3 Connection trouble is a layer, not a status

If the server is down or the shopper is offline, the last status the page knew stays on screen with a notice in the strip. A connection problem never shows as `failed` or `expired`.

| Notice | When |
|---|---|
| "You appear to be offline. We'll pick up as soon as your connection returns." | The browser reports no connection, which is a hint and not proof. Polling pauses and resumes when it returns |
| "We can't reach the payment service. This page may be out of date until we reconnect. Retrying." with "Try now" | Everything else: 500s, timeouts, invalid responses, network errors while the browser says it is online |

Neither notice says the payment is safe or unaffected. A failed request tells the page nothing about the payment.

While the connection is down, the address and QR **stay visible** on `underpaid`, and on `awaiting_payment` while the quote still has time left. The quote is valid until its deadline whether or not this page can reach the server, and the shopper's wallet is usually on another device. Once the countdown reaches zero they are hidden, because the page can no longer confirm the quote is live.

### 7.4 Shopper safety on the pay screen

- **The network is named in six places:** on the picker's button before any address appears ("Continue with USDT on Tron"), in the pay screen's heading, in the banner under it, in the address label, on the copy button ("Copy Tron address"), and on the frame around the QR.
- **The QR holds the address only.** An Ethereum address and a Polygon address look identical, so the QR itself carries no network information, and a wallet that scans it learns nothing about the network. That is a real limit of this design. The frame around the QR names the network, and the step that stands in for a machine-readable network is the picker's button, which the shopper presses with the network named on it immediately before the address appears.
- **Nothing is preselected in the picker,** and changing the currency clears the network, so the network is chosen on purpose. The one network filled in for the shopper is ETH's, because ETH has only one (section 11).

## 8. The mock and the dev panel

The mock is a small Express app mounted inside the dev server, so `npm run dev` starts one process on one port. `npm run preview` mounts it too. It keeps payments in memory, so restarting the server forgets them.

**What it does:**

- `POST /api/payments` creates a payment with a new reference every time.
- Quotes come from a hand-written table, one row per currency and network, each with its own rate, fee and address.
- `GET /api/payments/:reference` returns the whole payment (merchant, order, quote) plus the status fields.
- `awaiting_payment` becomes `expired` when the deadline passes. No other status expires by itself, so a payment that is showing money does not. The mock keeps only the current status: a payment put back to `awaiting_payment` from the dev panel can expire again.
- Requote succeeds only from `expired`. Anything else gets the 409.

**How reviewers drive it.** The control lives in the mock, not in the app's requests. The dev panel calls control endpoints under `/__mock`, and the app's own request code never knows a mock exists. The same endpoints work with `curl`.

![Dev panel](design/dev-panel-proposal.png)

| Control | Options |
|---|---|
| Set status | Eight buttons, usable in any order, plus a confirmations stepper |
| Start over | "restart this payment" puts the open payment back to `awaiting_payment` with a new quote and reloads the page. "new payment" reloads to the picker |
| New quotes last | 30 s, 2 min, 15 min, applied to new quotes |
| Faults, on every API request | Delay of 3 s or 15 s; HTTP 500; dropped connection. The control endpoints are exempt |
| Server clock offset | −5 min, 0, +5 min, to see the clock-difference handling without changing the system clock |

The offline notice is tested with the browser's own offline switch.

From 900 px wide, the panel is docked on the right and pushes the card aside instead of covering it, so a reviewer can change a status and watch the page react. On a narrower window it lies over the page. It starts collapsed. It slides open and closed in 200 ms, or at once when the system asks for reduced motion, and it remembers being open for the life of the tab, so it is still open after a reload.

What the build changed from the drawing:

- **No live readout.** The drawing shows the mock's status and time left, refreshed every two seconds. I cut it before the panel was built, because it needed its own polling loop to show what the checkout page beside it already shows. The panel shows the open payment's reference and the statuses the page has seen, taken from the page's own data. It reads the mock's settings once each time it opens, so its buttons match the mock after a reload.
- **A failed command shows nothing in the panel.** The checkout page beside it already reports a payment the server does not know.
- **Start over.** Added after the build, at my request. Once a payment is `paid`, `overpaid` or `failed` the page stops polling, and it remembers the statuses it has seen, so a status pressed afterwards could not bring the page back. The buttons reload the page because loading it again is the only thing that clears that memory.
- **It is in every build's bundle.** The mock is not: it exists only inside Vite's dev and preview servers. A static deployment of the build would show the panel with no API behind it. A real deployment would have neither.

After `paid`, `overpaid` or `failed` the page has stopped asking the server (3.7), so a status set from the panel after that shows only after a reload.

## 9. Assumptions and open questions

These are places where the brief is silent or does not fit together. Each is a question I would ask the backend team.

| Topic | What the brief says | What I assumed |
|---|---|---|
| Number of statuses | "There are six more states" beyond the four in the diagram | The API defines four more. I built for eight in total |
| Fee unit | The catalogue lists a `network_fee` of `3.20` for ETH; the one example quote, for USDT on Tron, adds the fee in the crypto's own units | The catalogue is served exactly as given. I read its fees as USD. Each quote carries the fee converted into the crypto's units, one to one for USDT and USDC. The brief shows no ETH quote, so I defined one: `3.20` USD at 3,000 USD per ETH is a fee of `0.001066666666666667` ETH. This is an assumption, not something the brief states |
| Order details before a payment | Merchant and order amount come only inside a payment | The page is handed an order summary, `{ order_id, merchant, order }`, by whatever sent the shopper here: the merchant's checkout, or a call made before this page. The build keeps it as a constant in `src/config/checkout.ts`, and `?order_id=` in the URL can replace the id. It is for display only, and the server never confirms it: if it disagreed with the payment the server creates, the pay screen would show the server's values. I did not invent an order endpoint |
| What `GET` returns | "Returns the payment with an updated status, plus the fields below" | The whole payment, plus the status fields |
| Repeated `POST /api/payments` | Not stated | A new payment with a new reference each time |
| Address on `underpaid` | The response carries its own `crypto_address`; the example repeats the quote's | The page shows and copies the address in the `underpaid` answer. Its wording says "Same address as before", which assumes a server repeats the quote's address as the brief's example does. If one sent a different address, the address on screen would be the right one and that sentence would not be true |
| Deadline on `underpaid` | The response has no deadline field | There is none. Once any money has arrived, the mock does not expire the payment and the page shows no countdown. If a server reports `expired` after `underpaid` anyway, the page treats it as a dead end |
| Funds from a partial payment that expired | Not stated. Requote returns the "same body as `POST /api/payments`", with no word on earlier funds | The page does not guess. It offers no new quote and sends the shopper to the merchant |
| Money arriving after expiry | No status for it | The server may move `expired` to `detected`, so the page keeps watching |
| Is `expired` terminal? | "Stop polling on terminal states", without listing them | Only `paid`, `overpaid` and `failed` are terminal. `expired` can return to `awaiting_payment` through requote |
| Money sent to an earlier quote after a requote | Not stated | The page cannot attribute it. It offers a new quote only when it has seen no money for the current quote, and it shows whatever the server reports |
| An unknown reference | Not stated | The mock returns 404 in the same problem format |
| An answer about another payment or pair | Not stated | The page checks a create or requote answer against the shopper's choice, and every answer against the reference it asked for. A later poll cannot be checked against the choice, because the page keeps no record of it across a reload, so the network the server states is named beside the address in every case |
| `failed` reasons | One example, `settlement_rejected` | Known codes get plain words. Any other code gets generic wording with the code in small print |

## 10. Follow-ups

Things I left out on purpose, and what each would need:

- **Wallet payment links in the QR.** A standard link would prefill the amount in the shopper's wallet. Token links need each token's contract address, which the API does not return. ([ADR 0004](adr/0004-qr-holds-address-only.md))
- **Loading the order summary.** Until a payment exists, the header comes from an assumed object. A real page needs it from the merchant's checkout, or from an endpoint that returns the order before a payment exists.
- **Fees in the order's currency.** The picker shows catalogue fees in USD while the order is in EUR.
- **A server time source for the countdown.** A time field in the response body would remove the device-clock error. ([ADR 0001](adr/0001-server-decides-expiry.md))
- **Full resume after a reload.** The status sequence restarts on reload, so the page forgets that money was seen. Keeping the sequence in session storage would restore the exact wording, and even a single stored "money was seen" flag per payment would close the gap on the same device. ([ADR 0005](adr/0005-resume-from-url-reference.md))
- **Making "money was seen" permanent for a quote.** Today a quote that goes `detected`, back to `awaiting_payment`, then `expired` offers a new quote behind the tick box. Treating it as a dead end would be stricter, at the cost of the dropped-transaction path.
- **A new quote after a partial payment.** Needs the backend to define what happens to funds already sent.
- **Checking every poll against the shopper's choice.** Needs the choice to survive a reload (section 9).
- **The countdown bar after a reload.** The bar is drawn only when the page saw the quote begin. Drawing it after a reload needs the quote's lifetime or start time in the response.
- **A live readout and error messages in the dev panel.**
- **Browser end-to-end tests.**
- **A mock script that advances a payment by itself.** The dev panel's status buttons already reach every state.

## 11. Details set by default

These were not discussed one by one. I set them while writing this document, and each is easy to change.

- **Timings:** poll every 3 s, 15 s on `expired`, backoff doubling from 3 s up to 30 s, request timeout 10 s, "still working" hint at 4 s, connection notice after two failed polls in a row.
- **Order summary:** the assumed object is order `ORD-88213` for Nordwind Audio, EUR 149.90, the same values the mock returns. `?order_id=` in the URL replaces the id and nothing else.
- **Merchant logo:** the header shows `merchant.logo_url` when there is one, with an empty `alt`, because the merchant's name beside it is its text. With no logo, or one that fails to load, it shows the first letter of the name. The brief's merchant has no logo, so the running page shows the letter; tests cover the image.
- **Exchange rate:** shown under the amount, exactly as sent ("1 USDT = 0.9214 EUR").
- **Going back from a live quote:** the browser's modal dialog. "Have you already sent a payment? Only change if you have not sent anything." The safe answer, "Stay on this payment", has focus when it opens. Staying, or pressing Escape, returns focus to the "Change currency or network" button. Confirming opens the picker.
- **`expired` tick box:** on the plain and cautious `expired` screens it enables both "Get a new quote" and "Change currency or network".
- **`expired` straight after `detected` or `confirming`:** this should not happen on a real server, but the dev panel can force it. It gets the same dead end as after a partial payment, with the headline "This payment expired".
- **Picker sections:** two groups of radio buttons, Currency and then Network, described in section 11.2. Each network option shows its fee and usual time. A section closes to one row once something is chosen in it. While the Network section is closed, the chosen network's fee, usual time and confirmations are on a line under it. A currency with one network (ETH) has it filled in.
- **Payment not found on resume:** back to the picker with a notice.
- **Copy buttons:** on the pay screen each sits under the value it copies, at its left edge. A successful copy reads "Copied" for two seconds: the button narrows to fit the word and widens back, inside a space that does not change. A failed one keeps the label and puts "Copy failed. Select the text and copy it." on a line under the button for four seconds. Both are announced to screen readers. The feedback belongs to the value that was copied: if the value beside the button changes, the feedback goes at once, so "Copied" never sits beside an amount that is not on the clipboard.
- **Dates and times:** formatted for the shopper's locale and time zone.
- **Accessibility:** a change of screen is announced. Within a payment, focus moves to the new screen's heading when the kind of screen changes, except onto the pay screen and the loading card, which have no heading and leave focus where it is. The picker does not take focus. The countdown is not read out every second, and colour is never the only signal. Keyboard focus shows as an outline on every control in the checkout (section 11.1).
- **Mock control endpoints:** `GET /__mock/state`, `POST /__mock/payments/:reference/status`, `POST /__mock/payments/:reference/restart`, `POST /__mock/settings`.
- **Tools:** Vite, React and TypeScript in strict mode; Tailwind; TanStack Query; zod; `qrcode.react` for the QR; Express for the mock; Vitest and React Testing Library; ESLint and Prettier; npm.
- **Browsers:** written for current Chrome, Safari, Firefox and Edge. Checked in Chrome only.

Checked during the build: a dropped connection from the mock mounted in the dev server arrives as no HTTP response at all, not as a 500. Through `npm run dev`, `curl` printed status `000` and exited with code 52 ("Empty reply from server"). Node's `fetch` rejects on it in the mock's tests. In a browser, with the mock set to drop, the page kept the last status, showed the notice after two failed polls, sent exactly one request for "Try now", and recovered by itself once the fault was switched off.

Checked during the build: TanStack Query never starts a second request for a payment while one is in flight. The polling test holds a request open and fires every trigger at it: ten seconds of interval ticks, a manual check twice, the tab hidden and shown, and the browser going offline and back. The seven fetches those triggers made all joined the open request, and no more than one request was ever in flight.

Checked during the build: TypeScript's typings do not accept the amount string in the number formatter without a cast. TypeScript 6.0 types `Intl.NumberFormat.format` as taking a number, a bigint or a `${number}` literal type, and a validated decimal string is a branded `string`, so it is rejected. `formatFiat` casts the method's signature and nothing else, and passes the string unchanged. Node formats it exactly, and a test checks that `1234567890123456.78` comes through with every digit.

### 11.1 How the page looks, and what moves

Added on 13 Nov 2026, after I asked for a review of the rendered page at 1200, 768, 390 and 320 px. It changed how the screens look and nothing they say. Tasks 19 to 27 of the plan did the work.

**One set of values.** Colours, six text sizes and two corner radii are named once, in the `@theme` block of `src/index.css`. The large amount's fluid size is a utility defined beside them, `text-amount`, and fully round shapes use Tailwind's own `rounded-full`. The screens use only these.

| Kind | Values |
|---|---|
| Colour | Named by role, not by shade: `page`, `surface`, `ink` and its three lighter steps, `line`, `action`, `link`, `focus`, and `ok`, `warn`, `bad` and `pending` for status. The four chains' colours and what each needs to stay readable are in section 11.2 |
| Text size | 12, 14, 15, 16, 18 and 22 px, and one fluid size for the large crypto amount on a screen, from 28 to 40 px with the window's width |
| Radius | 22 px for the card and the dialog, 12 px for controls and boxes, and fully round |

No colour code and no other text size or radius appears in `src/screens` or `src/components`. The dev panel keeps its own colours, so it never looks like part of the checkout.

Three pieces are reused across screens: `Button` (a pill for the main action, black everywhere except the picker's Continue, which takes the chosen chain's colour; a bordered control for copy, "Try now" and "Change currency or network"; and an underlined one that looks like a link; all three are buttons), `Notice` (the amber box) and `StatusIcon` (the pending, clock, check and alert marks, drawn as SVG).

**Nothing is cut off.** Down to 320 px wide, a long merchant name, network name, order id or amount wraps inside the card. A currency code is never split across two lines: the amount breaks at the space before it. Under 480 px the order id and the fiat amount take a row of their own under the merchant. From 768 px up, the card's two columns are at least 460 px tall, so a short screen does not make the card jump.

**Things that keep their place.** A copy button always takes the space of its normal label, wrapped or not: when it shows "Copied" it narrows inside that space and widens back, and nothing beside or under it moves. A connection notice takes the left of the strip and wraps there, with "Try now" and the "Change currency or network" button together on the right. At 1200 px a notice no longer changes the card's height at all, because the strip is already as tall as the button in it; it first made the card 49 px taller.

**Keyboard focus** shows as a 2 px outline, 2 px off the control, on every button, radio button and tick box in the checkout. The dev panel keeps the browser's own.

**A partial payment's new amount** is marked in two ways that last as long as the status does: the label "Send the remaining" is in the `warn` colour, and the amount has a `warn` rule down its left side. When it first appears, the block is also washed in the pale `warn` colour for 1.5 s. The lasting marks do not depend on that motion.

**What moves, and what never does.**

| What | Motion |
|---|---|
| A new screen's content, in its one or two columns | Fades in and rises 8 px, 180 ms. The strip under it does not move |
| The card's width, between the picker and a payment | The most it can be moves between 520 and 940 px over 200 ms. A narrower window gets a narrower card |
| A picker section opening or closing | Its height moves over 200 ms, and a chosen option takes its colour over 120 ms |
| A copy button after a successful copy | Narrows to "Copied" and widens back, 180 ms each way |
| The picker's fee line, each time the Network section closes on a network, and the wallet sentence, when a network is first chosen | Fade in and rise 6 px, 160 ms |
| "Still working…", a create or requote error, the copy failure line, a connection notice, and the address and QR coming back | Fades in, 150 ms |
| The confirmations bar | Moves to the server's count over 300 ms, in either direction |
| The countdown bar | Follows each second over 1 s, so it moves steadily |
| The change dialog and its backdrop | Fade in over 150 ms, the dialog from 98% of its size |
| Buttons | Change colour over 120 ms. A copy button's colour moves with its width, over 180 ms |

Nothing the server takes away is animated out. When the server's answer takes the address and QR away, they are gone in the same render, and the same goes for a notice, the dialog and a whole screen. What does close with a movement is the shopper's own doing: a picker section after a choice, and a copy button after a copy. The only things that fade away are the wash, which is a tint behind the amount and not the amount, and, outside the checkout, the dev panel's tab as the panel opens. A change of amount and each tick of the countdown happen in one frame: the digits are never counted, tweened or cross-faded. They do fade in with the rest of their column when a screen first appears. With "reduce motion" set on the device, one rule makes every transition and animation instant.

The fades use the browser's `@starting-style`. A browser without it shows the content at once, with no fade, and nothing else changes.

**How it was checked.** The tests run without a browser's layout, so they cannot see any of this. The planning agent drove the real page in headless Chrome: 17 screens at four widths measured for clipped elements and a split currency code, a run with very long names and a 23-digit order amount, and timed samples of each motion, including that no frame shows an address once the screen that replaced it is up. Those scripts are not in the repository.

### 11.2 The picker and the chains' colours

Added on 13 Nov 2026. After the look had been reviewed I chose a different picker and the chains' own colours from a second set of drawings. Tasks 29 to 34 of the plan did the work.

**The picker** is one card, one column, at most 520 px wide at every window width. From top to bottom: the order header, "Choose how to pay", the Currency section, the Network section, a line with the chosen network's fee, usual time and confirmations while that section is closed, the Continue button, and under it the sentence saying which currency and network the shopper's wallet must be able to send.

- Each section is a group of radio buttons. A network option shows its chip, its name, and under the name its fee and usual time, so every network's cost is visible before one is chosen.
- A section closes to one row once something is chosen in it: the chosen name and a "Change" button. The fee line under the Network section is shown only while that section is closed. Open, every option carries its own fee and time, so the line would say it twice. The Network section does not appear until a currency is chosen. Changing the currency opens it again with nothing chosen, and a currency with one network has it filled in, as before.
- Nothing is chosen and nothing has focus when the page loads.
- With a keyboard, Tab reaches the first option without choosing it. The arrow keys choose, as radio buttons do, and a choice closes the section. Focus then goes to the first network, or to the Continue button once both are chosen. "Change" opens the section again with focus on the chosen option. If the server lists a currency with no networks, focus goes to that currency's "Change" button. Focus never rests on something hidden: the form of a section that is not showing is inert.
- While a create or a new quote is in flight, the radio buttons and the "Change" buttons are disabled.

What the agreed drawing has and the picker no longer does: two menus, a right-hand column, a "You are paying with" pill, and the sentence "The amount to send and the address are shown next."

**The card's width** belongs to one element around the checkout, which stays mounted. It sets the most the card can be wide: 520 px while the picker or its loading card is showing, 940 px while a payment is. A narrower window gets a narrower card. That limit moves between the two over 200 ms. A page loaded on a payment starts at the 940 px limit and does not move. The height is not animated.

**The chains' colours** are mine. Two of them cannot be used everywhere as they are, and the table says what each needs.

| Network | Colour | Text on a fill | Border and radio button |
|---|---|---|---|
| Ethereum | `#627EEA`. A filled control uses `#5770D0`, 11% darker | White, 4.53:1. On `#627EEA` it would be 3.69:1 | `#627EEA`, 3.69:1 on white |
| Polygon | `#8247E5` | White, 5.27:1 | The same colour |
| Tron | `#DC062B` | White, 5.12:1 | The same colour |
| Solana | `#14F195` | Near-black, 12.11:1. White would be 1.50:1 | `#0EA566`, 3.19:1 on white. The green itself would be 1.50:1 |
| Any other | Grey, `#6B7280` | White, 4.83:1 | The same colour |

One function, `networkColours`, answers what a network gets, so no screen decides it. The colours are used in five places: the network chip; a chosen network's option and its closed row, as a border with a 10% tint behind; the Continue button; the pay screen's network banner; and the QR frame with its label. Inside the banner and the frame's label the chip is reversed, so it stays visible on its own colour. The letter on a chip outside them is decoration, and on Ethereum's chip it is white at 3.69:1; the network's name is always in words beside it.

A network's colour is never used for a status. Tron's red is close to the red of a failed payment, and I accepted that: a status is a mark, a headline and a sentence, a network is a banner that names it, and the two never stand in for each other. Every place that carries a chain's colour also names the network in words.

**"Change currency or network"** is a bordered button on the pay screen and on the expired screen. The picker's "Back" is still an underlined one.

## 12. One thing I would defend

**The page never declares a quote expired by itself.**

The brief says: "When it reaches zero, show an expired state and a way to get a new quote." I do something different. When the countdown reaches zero, the page hides the address, says "Time's up. Checking with the payment service.", and asks the server. Only the server's `expired` shows the expired screen. If the server says the quote is still live, the address comes back and the timer goes away.

The countdown runs on the shopper's device clock, and that clock can be wrong in either direction. If the page trusted it, a shopper whose clock runs ahead would be told "expired" on a live quote and sent to requote, which the API refuses with a 409. Worse, in the seconds around the deadline the page would be showing "expired, get a new quote" to someone whose money is already on its way. The brief's own last line is that a simple page is better than one that expires the quote while the shopper's money is on the way. Asking the server first costs one request and, in the normal case, a fraction of a second of "checking". I think that is the right price for never being wrong about it.
