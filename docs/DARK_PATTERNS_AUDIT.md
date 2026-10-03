# Dark-pattern self-audit

The Central Consumer Protection Authority's 2023 guidelines list 13 dark patterns. From 2027-01-01 the E-Commerce Amendment Rules 2026 are reported to require a yearly self-audit with a displayed certificate (`docs/LEGAL_REVIEW.md` section 1; confirm in the Gazette).

**Status: a code walk-through on 2026-10-03, done by the engineering side. It is NOT a signed audit and nothing on the site claims one.** The grievance page shows an audit line only once the owner sets `LEGAL.darkPatternAudit` (`web/src/lib/legal.ts`) after signing a real audit. Repeat the walk-through with the live site every year and before any new checkout or promotion feature.

| # | Pattern | What to look for | Finding (2026-10-03) |
|---|---|---|---|
| 1 | False urgency | Countdown timers, "only N left", "selling fast", fake viewers | None found. The drops page says there is no countdown. "One of one" appears only on pieces flagged one-of-a-kind, which the admin limits to stock of 1. The 10-minute checkout hold is real (`api` stock-hold tests). Keep it that way: never add a timer or scarcity line that is not true. |
| 2 | Basket sneaking | Items, insurance or donations added without the shopper choosing | None. Gift wrap is an unticked option; shipping and any COD fee are shown as separate lines. |
| 3 | Confirm shaming | Guilt wording on a decline button | None found in checkout, signup or cookie-free pages. Re-check any new popup. |
| 4 | Forced action | Account or consent required to do something unrelated | Guest checkout exists. Signup asks only for what the account needs. |
| 5 | Subscription trap | Hard cancellation, hidden renewals | No subscriptions. |
| 6 | Interface interference | Pre-ticked boxes, hidden or tiny decline options | Terms and policy checkboxes at signup and checkout start unticked (`SignupForm`, `PolicyCheckbox`). Keep any future marketing box unticked and separate. |
| 7 | Bait and switch | Advertised price changes at the end | The price on a product page matches the basket; the server prices the basket. A wrongly shown price is handled in the terms. |
| 8 | Drip pricing | Fees revealed only at the last step | Shipping, gift wrap and COD fee appear as lines in the cart and checkout before the pay button; the pricing page lists them. Import duties are not ours and are explained in the shipping policy and FAQ. |
| 9 | Disguised advertisement | Ads shown as content | None. |
| 10 | Nagging | Repeated popups or prompts | The WhatsApp nudge shows once per session. No newsletter popup. |
| 11 | Trick question | Confusing double negatives on choices | None found. |
| 12 | SaaS billing | Recurring charges without notice | Not applicable. |
| 13 | Rogue malware | Deceptive downloads or installs | Not applicable. |

Also checked: the "previous price" (strike-through) must be the lowest price in the prior 30 days (E-Commerce Amendment Rules 2026, r.4(13), from 2027-01-01). The admin field is labelled that way. There is no price-history table yet, so the maker has to keep this true by hand (`TODOS.md`).
