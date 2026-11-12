# Agent log

A running record of where the coding agent and I disagreed, and where it got something wrong. Entries are added when they happen. The README's "Working with the agent" section is written from this file.

Each entry: what the agent proposed, what was decided, and why.

## 12 Nov 2026: design session

The whole design was decided in one long conversation before any code. The agent read the brief, raised each decision in turn with options and a recommendation, and I chose.

### Recommendations I rejected

| # | The agent recommended | I decided | Why |
|---|---|---|---|
| 1 | Correct the countdown from the server's `Date` response header, with a fallback chain for when the header is missing | Use the device clock | The header was my own first idea, and the agent backed it. Once we listed its gaps (unreadable cross-origin without an extra header, optional on 5xx, stale when cached), it was a lot of moving parts for a number that is only information. The server's status decides expiry either way. See ADR 0001 |
| 2 | Any received money stops the clock, so `underpaid` never expires | The original deadline still applies to `underpaid` | A quote is a price held for a limited time. Stopping the clock leaves the rate open with no limit. See ADR 0003 |
| 3 | A wallet payment link in the QR for plain ETH, with a `BigInt` conversion to base units, and a plain address for the tokens | The plain address in every QR | One combination behaving differently from five is not worth a conversion helper. Standard links are a follow-up once the API returns contract addresses. See ADR 0004 |
| 4 | Serve ETH's network fee literally as `3.20` ETH and flag it as unrealistic | Read catalogue fees as USD and convert them in the quote | `3.20` ETH on an order worth about 0.05 ETH makes no sense, and a shopper-facing page should not show it |
| 5 | Start over at the picker on refresh, because the brief puts persistence out of scope | Resume from a reference in the URL | A page that forgets a payment in flight is a safety problem. See ADR 0005 |
| 6 | A picker with every network visible as a card, with its fee and time | Two menus, as in the G2A reference flow | More compact, and closer to a flow shoppers already know |
| 7 | Add an order endpoint to the mock so the picker can show the merchant name and amount | Keep to the API as given; the picker shows the order reference only | We had refused to invent API elsewhere. Staying consistent mattered more than a fuller picker |

### One place I did it my own way

To tell "expired" from "expired after a partial payment", the agent proposed remembering a single fact: that money had arrived. I asked for the full sequence of statuses the page has seen, with the amounts that came with each.

The design now leans on the sequence for more than that one screen. The `failed` screen uses it to say whether money was seen. The reload case uses it to know its own history is incomplete. The dev panel shows it for debugging.

### What the agent got wrong

- **Hiding the address at zero.** The agent first proposed hiding the address the moment the countdown reached zero. That was fine while the clock was going to be corrected from the server. After I chose the device clock, the same rule would have locked out any shopper whose clock runs ahead: the countdown would sit at zero and the address would never show. The agent caught this itself when the clock decision changed and rewrote the rule so that a "still live" answer from the server brings the address back.
- **A picker the API cannot fill.** The agent drew the picker with the merchant name and "You pay €149.90", and I approved the drawing. Neither value is available before a payment exists; the API returns them only inside a payment. The agent noticed the gap later, while checking every agreed screen against the API, and the picker was redrawn.
- **About the payment state machine.** The brief says there are "six more states" beyond the four in its diagram. The API defines four more. I pointed this out before the agent read the brief, so it did not get the chance to miscount; it confirmed eight. It made no factual error about the statuses in this session. On entry 2 above, where it wanted the clock to stop on `underpaid` as it does on `detected`, I disagreed at first and came round after the review; see "Where the review changed a decision of mine".

## 12 Nov 2026: review of the first draft

Two reviews read the first draft of the design before I approved it. One was a fresh agent acting as a builder who has to plan from the document alone. The other was Codex, a different model, checking the design against the brief.

### What the reviews caught in the agent's draft

All of these are fixed in the design doc.

- **An unbacked promise.** The outage notice said "Your payment is unaffected." A failed request tells the page nothing about the payment. This broke the draft's own rule against promising what the API does not state.
- **A stale address after the tab returns.** When the device clock turns out to be wrong, the page shows the address with no timer. The draft would have kept showing it while the tab came back from the background, before a fresh answer arrived. That state now depends on an answer from the last 10 seconds.
- **A status that goes backwards.** `detected` followed by `awaiting_payment` would have brought the address back and invited a second payment. I chose to keep the address hidden once money was seen for a quote.
- **No cache rule.** Nothing said that status requests must bypass the HTTP cache.
- **A tick box nobody could truthfully tick.** "I have not sent a payment" was described as gating every expired screen, including the one for a shopper who had paid part.
- **A rule with no data behind it.** The decimal-places check was written for every amount, but only crypto currencies have a `decimals` value.
- **A design that leaned on a document the repo does not contain.** The draft never restated the API it was designed against, so a builder without the brief could not have planned from it. Section 4.5 now does.

### Where the review changed a decision of mine

- **No new quote after a partial payment.** In the design session I had decided that a quote which expired after a partial payment would offer a new quote for the full amount, with a warning that the earlier funds would not count. Codex pointed out that the API says nothing about what happens to those funds, so the warning was a guess told to the shopper as fact, against the design's own wording rule. The agent proposed softening the wording. I went further and removed the new quote: that screen is now a dead end that points to the merchant. See ADR 0003.

- **Any money stops the clock.** This reverses entry 2 in the table above, so that recommendation was not thrown away in the end. Codex read the brief's line, that a payment on its way must never expire under the shopper, as covering a partial payment. Two things made me agree. After the change above, missing the deadline on a partial payment had become a dead end. And the page never expires anything by itself, so it was our own mock that would have stranded the shopper. The countdown now exists only while nothing has arrived. See ADR 0003, which records how the decision moved.

### What Codex argued that I kept as it was

- **A slow device clock during an outage.** Codex showed that two of my decisions combine badly: the countdown uses the device clock, and the address stays visible during an outage until that countdown reaches zero. With a slow clock and an unreachable server, the real deadline can pass while the address is still on screen. I kept both decisions and wrote the consequence into ADR 0001. Hiding the address after a period of silence would hurt the common case, a correct clock and a short outage, to protect a rare double failure.
- **The ETH fee.** Codex wanted the catalogue's `3.20` served literally as ETH, or the question put to the recruiting contact. I kept my reading of catalogue fees as USD. The catalogue itself is served exactly as given; the brief shows only one example quote, so the ETH quote was mine to define either way. It is listed as an assumption in the design doc.
- **Polling on `expired`.** Codex noted the brief says to stop polling on terminal states and the API never says `expired` can change. I kept the polling, because stopping there invites a second payment from a shopper whose first one is in flight. Whether `expired` is terminal is now an explicit open question.
- **Resuming after a refresh.** Codex noted the brief puts persistence out of scope. I kept it; ADR 0005 already argues why.
- **The QR and the network.** Codex noted that a QR holding only an address gives the wallet no network. That is true and stays true until the API returns what a payment link needs. The design doc now states the limit plainly and no longer says a wrong-network send is impossible.

## 12 Nov 2026: second review pass

Codex read the revised documents once more. This was the second and last pass on the design.

### What it caught in the agent's revisions

- **An amount shown before it was checked.** To avoid hiding a payment in flight, the agent had let a resumed payment render before the currency list arrived, which meant an amount to send could appear before its decimal-places check. Now only the pay screen waits for the list. Screens that only report a status do not.
- **An unknown status with no way forward.** The "we're checking" screen for a status the page does not know had no reference and no contact line, so a status that never resolved left the shopper stuck. It now has both.

### What Codex argued that I kept as it was

- **Changing currency while a quote is live.** Codex wanted no change allowed once an address has been shown, because the confirmation cannot rule out a transfer started on another device. I kept the confirmation. A shopper who picked the wrong network should not have to wait for the quote to expire before they can correct it.

### What Codex raised that I deferred

- **Money seen, then forgotten.** Two paths still lead to a new quote after the page has seen money: a status that goes backwards and then expires, and a reload, which restarts the status sequence. Both sit behind the "I have not sent a payment" tick box. I approved the design with these as known limits and listed the fixes as follow-ups in the design doc.

## 12 Nov 2026: the plan

The agent wrote the task plan from the approved design. Two checks ran before any code was written.

### What the agent's own pre-flight check caught

- **A requote that would have created a second payment.** The plan made "create or requote" depend on which screen was showing. But "Get a new quote" is pressed on the expired screen, where the plan would have chosen "create". The rule is now simple: a payment that already exists is requoted, and a new one is created only when there is none.

### What Codex caught in the plan

Codex raised fourteen points and all of them held up. The four that mattered most:

- **A double-click guard that did not guard.** The plan stopped a second write by checking React state, which is still stale when two clicks land before a re-render. It is now a latch set synchronously before the request starts.
- **Behaviour inside components.** The plan put timers, clipboard access and effects in components, against this repo's own rule that components render and hooks own behaviour. The plan now names a hook for each, and `AGENTS.md` says exactly what a component may hold: view state nothing else reads.
- **A pay screen that could load forever.** After a reload, if the currency list failed to load, the pay screen had no way to tell "still loading" from "failed" and no retry.
- **Copy buttons that did not say what they copy.** The status screens had buttons labelled just "Copy", against the rule that a copy button names what it copies.

## 12 Nov 2026: the build

### Task 1

- **A plan written from stale knowledge.** The planning agent told the implementer to keep "the template's ESLint config". The current Vite template no longer has one: it ships oxlint and TypeScript 7. The implementing agent stopped at the first step and reported it, with the options, instead of improvising. The decision was to pin the last template version that ships ESLint, because the lint rule that bans `Number(...)` on amounts cannot be written in oxlint.
- **A test setup that leaked between tests.** The plan never said to clean up after each component test, and the implementer did not add it. With Vitest's globals off, Testing Library does not register its own cleanup, so every later component test would have found earlier renders still on the page. I caught it reading the commit; Codex did not. The fix came with a two-render probe that failed before and passed after.
- **A lint rule narrower than the rule it enforces.** The plan asked for a ban on `parseFloat` and `Number(...)`. The implementer pointed out that `Number.parseFloat` and `new Number` got past it. The rule now covers every form the Money rule in `AGENTS.md` names, including `toFixed` and unary plus.

### Task 2

- **An order of checks taken from the wrong place.** The mock's requote checked whether the quote had expired before checking that the requested currency and network exist, so a request for a pair that does not exist got "not expired" where it should get "invalid request". The implementing agent said afterwards that it had taken the order from the order in which a type listed its cases. Codex caught it. A request is now validated before the payment's state is looked at.
- **Wording close to the brief, but not the brief's.** The 409 said "Quote not expired" where the brief's example says "Quote has not expired". I caught it reading the commit. The brief gives the fixture, so the mock now uses its words exactly.

### Task 3

- **A plan rule that contradicted the design.** The plan said the mock refuses any negative setting. The design's dev panel sets the server clock five minutes behind, which is a negative number. The implementing agent noticed, applied the rule only to the quote lifetime and the delay, and reported it.
- **A delay that outlived its request.** With the mock set to respond slowly, a request the page had already given up on still ran on the server when the delay ended. Codex caught it. The timer is now cleared when the connection closes.
- **A test that proved nothing.** For that fix, the planning agent specified a test: abort a slow create, then check that no payment appeared. The implementing agent ran it against the unfixed code first and found it passed anyway, because Node discards the body of an aborted request before the handler can use it. It said so and wrote a test that does fail without the fix. I would not have known the first test was empty.
- **Nothing tested the Vite plugin.** Removing either of its two hooks would have left every test green. Codex caught it.

### Task 4

- Nothing was rejected. Codex had no findings. The implementing agent removed three validation rules in turn to show that the tests fail when the behaviour is gone, which is the check I now ask every task for.

### Task 5

- **Tests that would not have caught a regression.** The API client itself had no bugs, but Codex found three places where its tests proved less than they claimed: timeouts and aborts were only tested while the request was pending, not while the body was being read; the success test would have passed if the parser's result were thrown away; and the two error checks were never tried against a look-alike object. The implementing agent then showed the gaps were real: the original suite let four deliberate breakages through.

### Task 6

- Nothing was rejected. Codex had no findings. The implementing agent raised a risk in a later task on its own: a poll already in flight that comes back after a requote would be taken for a new quote. The plan already cancels that poll first, and the warning now travels with Task 8.

### Task 7

- **A rule with a hole the implementer found.** The design said a quote that expires "straight after" a status with money is a dead end. The implementing agent built it as written, then pointed out what that lets through: money, then a status the page does not know, then expiry, gives the plain expired screen with its new-quote button. An unknown status says nothing about the money, so the rule now skips it when looking back. This tightens a rule I had approved, on the safer side.
- **Two sentences of mine that disagreed.** The implementer also noticed that one line of the design doc said a new quote is offered "only when the page has seen no money", while another said only the current quote's history counts. The code follows the second. The first is reworded.
- **A list nobody tested in full.** Codex found that the expired tests did not cover every status that carries money, so dropping `paid` from that list would have gone unnoticed. Each one now has a case.
