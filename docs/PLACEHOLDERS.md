# Placeholder registry

Everything below is stand-in content. It is tagged three ways so nothing slips through:

1. **In code:** a `PLACEHOLDER(id)` comment at the source.
2. **In the UI:** a `data-placeholder="id"` attribute. In the footer, tick **Show placeholder tags** (only visible while `NEXT_PUBLIC_USE_MOCK` is not `false`) to outline and label every one on screen.
3. **Here:** this list. Search the repo for `PLACEHOLDER(` to find them all.

Sample products additionally show a dashed **Sample** badge on their card.

_Resolved: `razorpay-test` and `razorpay-checkout` (the fake payment windows). Live payments now open Razorpay's own window (`web/src/lib/razorpay.ts`); the simulated windows stay only for sample data and a staging API in `PAYMENTS_MODE=mock`, and are no longer placeholders._

**Launch gate.** A build with `LAUNCH_BUILD=true` (and `NEXT_PUBLIC_USE_MOCK=false`, real URLs and WhatsApp number) scans `web/src` for `PLACEHOLDER(id)` tags and fails, listing each one, until they are resolved. To ship with a stand-in on purpose, name it: `PLACEHOLDERS_ALLOWED=instagram,size-chart`. Resolving a placeholder means removing its tag from the code along with the stand-in. (`web/src/lib/placeholders-scan.ts`, wired in `web/next.config.ts`.)

| id | Where | What it is | Replace with |
|---|---|---|---|
| `catalogue` | `web/src/lib/mock/catalog.ts` (mock mode only) | Four whale-keychain fixtures (the maker's own photos; price, stock and lead time are stand-ins) and 8 shelves. The API seed creates no products at all | Real products via the admin / API. A real-API build never contains the fixtures |
| `sample-product` | Every `ProductTicket`, and the whale cards on the home page (`web/src/components/home/WhalePod.tsx`), while on mock data | Marks sample products on screen | Disappears once `sample` is not set |
| `category-images` | `api/prisma/seed-data/categories.ts`, `web/src/lib/mock/catalog.ts` | Shelf cover photos reuse the maker's own photos (`web/public/maker/`) until a shelf has a product of its own. Empty shelves are hidden from menus | A real cover per shelf in `/admin/categories` |
| `copy-process` | `web/src/components/home/HookFloor.tsx` | Making-process wording | The maker's real process |
| `copy-leadtimes` | `web/src/components/home/HookFloor.tsx` | "Ready 1–2 days / Made to order 4–10 days", and the arrival windows the ruler draws from them (plus `DOMESTIC_TRANSIT_DAYS`) | Real lead times |
| `example-work-order` | `web/src/components/home/WorkOrders.tsx` | Illustrative work order (WO-027, ₹1,850) | Keep as an example, or swap for a real (consented) one |
| `shipping-rates` | `web/src/lib/site.ts` (`SAMPLE_SETTINGS`), `ShippingDock.tsx`, `web/src/lib/pricing.ts` (`DOMESTIC_TRANSIT_DAYS`) | ₹79 domestic, free above ₹999, intl from ₹899, gift wrap ₹59, COD cap ₹2,000 / fee ₹49, 50% deposit; 3–6 days in transit inside India | Real rates; later moved to admin Settings. Transit days from the courier |
| `maker-note` | `web/src/components/home/HookFloor.tsx` (the note on the Hook Floor station) | Generic "Hi, I'm the maker" copy. The stall photo is real (`web/public/maker/founder-isb-stall.jpg`) | The maker's name and own words |
| `instagram` | `SITE.instagram` (the maker note's button) | `instagram.com/fuzzballfactory`, read off the stall's QR card | Confirmed handle |
| `whatsapp-number` | `web/src/lib/site.ts` (`NEXT_PUBLIC_WHATSAPP`) | `910000000000` | The real WhatsApp Business number (digits, with country code) |
| `contact-email` | `web/src/lib/site.ts` | `hello@fuzzballfactory.example` | Real email |
| `legal-details` | **`web/src/lib/legal.ts`** (the one place the facts live; every value starts `null`), read by `SellerDetails.tsx`, `contact/page.tsx`, `policies/*.tsx`, the product page. `privacy.tsx` still has two retention-period stand-ins (the order-record period and whether work-order conversations should also expire) | Bracketed stand-ins (rendered by `Ph`/`LegalValue`) for legal name, registered address, GST status and GSTIN, business phone, customer-care hours, grievance officer name/designation/email/phone/hours, court city, IP takedown email, courier partner, EU representative (if any) and the date of the first signed dark-pattern audit. `missingLegal()` lists what is still empty | The real legal details (Consumer Protection (E-Commerce) Rules 2020 and Razorpay require them). Search the repo for `PLACEHOLDER(legal-details)` |
| `policy-draft` | `web/src/components/content/policies/*.tsx`, `DraftNote.tsx` | The full text of shipping, refund, terms, privacy and grievance pages is a working draft (windows, fees, dispatch promises, provider list, DPDP wording) | Lawyer-reviewed final text. The "Draft: have this reviewed" banner disappears once `NEXT_PUBLIC_USE_MOCK=false` |
| `maker-note` (About page) | `web/src/app/(store)/about/page.tsx` | Maker name, photo and story slots on the About page | The maker's name, photo and own words |
| `contact-hours` | `web/src/app/(store)/contact/page.tsx` | Hours the maker replies | Real days and hours |
| `contact-form` | `web/src/components/support/TicketForm.tsx` | In mock mode the support forms keep tickets in the browser only and email nothing (they say so). In real mode they create tickets and email through Resend; the shop inbox needs `CONTACT_INBOX_EMAIL` (or `ADMIN_EMAIL`) | Set the inbox address on the server; the sample-mode note only shows in mock mode |
| `size-chart` | `web/src/app/(store)/size-guide/page.tsx` | Generic beanie (XS to L head cm) and top (bust, length cm) ranges | Ranges confirmed against the maker's own patterns |
| `size-chart` | `web/src/components/shop/SizeGuide.tsx` | Stand-in cm measurements for the beanie and halter | The maker's real size chart per product |
| `size-chart` | `web/src/components/shop/SizeGuide.tsx` (`CATEGORY_CHARTS`) | Generic category-level fallback charts ("wearables — hat", "wearables — top"), shown when a sized product has no exact-slug chart of its own | The maker's real size chart per product, added by exact slug so the fallback stops applying to it |
| `pdp-returns-copy` | `web/src/components/shop/ProductDetails.tsx` | Draft "Shipping & returns" wording on the product page (7-day exchange for ready pieces, no returns on made-to-order/custom) | Final wording from the policy pages |
| `mock-logins` | `web/src/components/account/auth/LoginForm.tsx` | Dev-only "Sample logins" hint under the login form (only when `SITE.useMock`) | Disappears automatically with `NEXT_PUBLIC_USE_MOCK=false` |
| `invoice-download` | `web/src/components/account/OrderDetailClient.tsx` | Disabled "Download invoice" control, "coming soon" | Real GST invoice PDF endpoint from the API |

## Invented-claims rule

No reviews, ratings, customer counts or press are shown anywhere. Keep it that way until real ones exist.

## Added by the custom / cart / checkout / track build

| id | Where | What it is | Replace with |
|---|---|---|---|
| `custom-lead-time` | `web/src/components/custom/CustomForm.tsx` (`DEFAULT_CUSTOM_LEAD_DAYS = 10`) | Rough days a from-scratch custom piece takes, used only to warn when "Needed by" looks tight | A real figure from admin Settings (or per category) |
| `hourly-rate` | `web/src/components/admin/custom/QuoteBuilder.tsx` (`DEFAULT_HOURLY_RATE`) | Sample ₹150/hour prefilled in the quote builder's "hours × rate" calculator | The maker's real hourly rate, ideally stored in admin Settings |

## Added by the materials inventory build

| id | Where | What it is | Replace with |
|---|---|---|---|
| `materials-catalogue` | `web/src/lib/mock/db.ts` | 4 sample inventory materials (cotton yarn, chenille yarn, safety eyes, poly-fil stuffing) with placeholder cost/qty/thresholds | Real stock, added and edited from the admin Materials page (`/admin/materials`) |
