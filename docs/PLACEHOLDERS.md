# Placeholder registry

Everything below is stand-in content. It is tagged three ways so nothing slips through:

1. **In code:** a `PLACEHOLDER(id)` comment at the source.
2. **In the UI:** a `data-placeholder="id"` attribute. In the footer, tick **Show placeholder tags** (only visible while `NEXT_PUBLIC_USE_MOCK` is not `false`) to outline and label every one on screen.
3. **Here:** this list. Search the repo for `PLACEHOLDER(` to find them all.

Sample products additionally show a dashed **Sample** badge on their card.

| id | Where | What it is | Replace with |
|---|---|---|---|
| `catalogue` | `web/src/lib/mock/catalog.ts` | 15 sample products, 8 categories, prices, lead times, fibers, sizes | Real products via admin / API |
| `sample-product` | Every `ProductTicket` while on mock data | Marks sample products on screen | Disappears once `sample` is not set |
| `sample-photo` | `YarnRoom.tsx`, `HookFloor.tsx`, `web/public/samples/*` | Openly licensed Wikimedia Commons photos (see `web/public/samples/PROVENANCE.md`) | The maker's own photos. Delete `web/public/samples/` afterwards |
| `copy-fibers` | `web/src/components/home/YarnRoom.tsx` | Generic list of fibers | The yarns actually used |
| `copy-process` | `web/src/components/home/HookFloor.tsx` | Making-process wording | The maker's real process |
| `copy-leadtimes` | `web/src/components/home/HookFloor.tsx` | "Ready 1–2 days / Made to order 4–10 days" | Real lead times |
| `example-work-order` | `web/src/components/home/WorkOrders.tsx` | Illustrative work order (WO-027, ₹1,850) | Keep as an example, or swap for a real (consented) one |
| `shipping-rates` | `web/src/lib/site.ts` (`SAMPLE_SETTINGS`), `ShippingDock.tsx` | ₹79 domestic, free above ₹999, intl from ₹899, gift wrap ₹59, COD cap ₹2,000 / fee ₹49, 50% deposit | Real rates; later moved to admin Settings |
| `maker-note` | `web/src/components/home/MakerNote.tsx` | Generic "Hi, I'm the maker" copy, no photo | The maker's name, photo and own words |
| `instagram` | `MakerNote.tsx`, `SITE.instagram` | Tiles use sample photos and link to instagram.com | Real handle and feed |
| `whatsapp-number` | `web/src/lib/site.ts` (`NEXT_PUBLIC_WHATSAPP`) | `910000000000` | The real WhatsApp Business number (digits, with country code) |
| `contact-email` | `web/src/lib/site.ts` | `hello@fuzzballfactory.example` | Real email |
| `legal-details` | `web/src/components/content/policies/*.tsx`, `SellerDetails.tsx`, `contact/page.tsx`, `terms.tsx` (GST wording, court city), `privacy.tsx` (retention periods) | Bracketed stand-ins for the seller's legal name, registered address, GSTIN, business phone, grievance officer name/designation/phone/hours, jurisdiction city and retention periods, rendered by `Ph` in `Placeholder.tsx` | The real legal details (Consumer Protection (E-Commerce) Rules 2020 and Razorpay require them). Search the repo for `PLACEHOLDER(legal-details)` |
| `policy-draft` | `web/src/components/content/policies/*.tsx`, `DraftNote.tsx` | The full text of shipping, refund, terms, privacy and grievance pages is a working draft (windows, fees, dispatch promises, provider list, DPDP wording) | Lawyer-reviewed final text. The "Draft: have this reviewed" banner disappears once `NEXT_PUBLIC_USE_MOCK=false` |
| `maker-note` (About page) | `web/src/app/(store)/about/page.tsx` | Maker name, photo and story slots on the About page | The maker's name, photo and own words |
| `contact-hours` | `web/src/app/(store)/contact/page.tsx` | Hours the maker replies | Real days and hours |
| `contact-form` | `web/src/components/content/ContactForm.tsx` | The form is mocked: nothing is sent | POST to the API / email provider, then remove the sample-mode note |
| `size-chart` | `web/src/app/(store)/size-guide/page.tsx` | Generic beanie (XS to L head cm) and top (bust, length cm) ranges | Ranges confirmed against the maker's own patterns |
| `size-chart` | `web/src/components/shop/SizeGuide.tsx` | Stand-in cm measurements for the beanie and halter | The maker's real size chart per product |
| `size-chart` | `web/src/components/shop/SizeGuide.tsx` (`CATEGORY_CHARTS`) | Generic category-level fallback charts ("wearables — hat", "wearables — top"), shown when a sized product has no exact-slug chart of its own | The maker's real size chart per product, added by exact slug so the fallback stops applying to it |
| `pdp-returns-copy` | `web/src/components/shop/ProductDetails.tsx` | Draft "Shipping & returns" wording on the product page (7-day exchange for ready pieces, no returns on made-to-order/custom) | Final wording from the policy pages |
| `razorpay-checkout` | `web/src/components/account/custom/TestPaymentModal.tsx` | Fake "Test payment" modal (Pay successfully / Simulate failure) for work-order deposit and balance | Razorpay Checkout with a server-created order, confirmed by webhook |
| `mock-logins` | `web/src/components/account/auth/LoginForm.tsx` | Dev-only "Sample logins" hint under the login form (only when `SITE.useMock`) | Disappears automatically with `NEXT_PUBLIC_USE_MOCK=false` |
| `invoice-download` | `web/src/components/account/OrderDetailClient.tsx` | Disabled "Download invoice" control, "coming soon" | Real GST invoice PDF endpoint from the API |
| `dpdp-deletion` | `web/src/components/account/ProfileClient.tsx` | "Delete your account" wording and the mock deletion request (records nothing) | Final wording from the privacy policy + real API request |

## Invented-claims rule

No reviews, ratings, customer counts or press are shown anywhere. Keep it that way until real ones exist.

## Added by the custom / cart / checkout / track build

| id | Where | What it is | Replace with |
|---|---|---|---|
| `razorpay-test` | `web/src/components/checkout/TestPaymentModal.tsx` (shown in the "Test payment" dialog at checkout) | Fake Razorpay window with "Pay successfully" / "Simulate failure" buttons; no money moves | Real Razorpay Checkout (`new Razorpay(options).open()`) plus server-side order creation and webhook (Phase 4) |
| `custom-lead-time` | `web/src/components/custom/CustomForm.tsx` (`DEFAULT_CUSTOM_LEAD_DAYS = 10`) | Rough days a from-scratch custom piece takes, used only to warn when "Needed by" looks tight | A real figure from admin Settings (or per category) |
| `hourly-rate` | `web/src/components/admin/custom/QuoteBuilder.tsx` (`DEFAULT_HOURLY_RATE`) | Sample ₹150/hour prefilled in the quote builder's "hours × rate" calculator | The maker's real hourly rate, ideally stored in admin Settings |

## Added by the materials inventory build

| id | Where | What it is | Replace with |
|---|---|---|---|
| `materials-catalogue` | `web/src/lib/mock/db.ts` | 4 sample inventory materials (cotton yarn, chenille yarn, safety eyes, poly-fil stuffing) with placeholder cost/qty/thresholds | Real stock, added and edited from the admin Materials page (`/admin/materials`) |
