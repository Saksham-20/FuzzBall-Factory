# Research Brief — Handmade Crochet Store (solo maker, India + international)

_Compiled 2026-09-21. Price ranges without a cited listing are estimates. Legal points are a summary, not legal advice._

## 1. Categories & India price ranges

Bestsellers: tulip/flower bouquets ("forever flowers"), tulip/cherry/strawberry keychains & bag charms, amigurumi plushies, bucket hats, totes/shoulder bags, crop/halter tops, hair accessories (claw clips, scrunchies), coasters, car hangers, baby booties/rattles, festive (rakhis, deity idols), hampers/gift combos.

| Item | ₹ range |
|---|---|
| Hair ties / claw clips | 200–350 |
| Keychains / bag charms | 250–700 |
| Single flower | 150–350 |
| Bouquet (3–7 stems) | 650–2,500 |
| Coasters (set of 4) | 400–900 |
| Small amigurumi (10–15 cm) | 500–1,200 |
| Large plush / custom character | 1,500–4,000 |
| Bucket hat | 800–1,800 |
| Tote / shoulder bag | 1,000–3,000 |
| Crop top / halter | 1,200–3,500 |
| Idols / rakhis | 300–1,350 |

Common: free shipping above ₹500–999, bulk/corporate orders page, hampers.

## 2. Product listing attributes

- Fiber/yarn (acrylic, milk cotton, chenille, cotton, wool blend) + allergy / baby-safety note
- Colorways + "colors may vary slightly (screens, yarn batches)"
- Size in cm; wearables get size chart + how-to-measure
- Fulfilment type: ready-to-ship vs made-to-order; lead time ("Ships in 5–7 days") on PDP, cart, checkout
- Care (hand wash cold, dry flat; safety-eyes warning for under-3s)
- Variants (color, size, with/without keyring); personalization fields (name text w/ char limit, gift note)
- Weight (+ package dims for volumetric shipping)
- Stock (qty 1 for one-of-a-kind)
- Country of origin "Made in India" (E-Commerce Rules 2020)

Photos: ≥2000px short side, 4:5 or 1:1, product ≥60% frame, one lighting session. 5–8 images: hero, stitch close-up, scale shot, lifestyle/on-body, color swatches, packaging. Optional 5–10s loop video. Serve WebP/AVIF.

## 3. Common problems → mitigations

- **Lead times:** "Made to order · ships in X days" badge everywhere; est. dispatch date at checkout; queue indicator; WhatsApp progress photo.
- **Color mismatch:** real swatch photos, consistent lighting, disclaimer, "send me a real-light photo" WhatsApp button.
- **Sizing:** cm measurements, model height/size; body measurements for custom tops.
- **Custom scope creep:** scope in quote (size, colors, revisions, details); changes after deposit are charged.
- **Pricing custom:** (materials + hours × rate) × (1 + margin) + ~2% gateway fee; +20–30% custom premium; flat design fee for original characters.
- **Deposits:** 50% before materials, non-refundable once work starts; balance before ship. Razorpay Payment Links fit.
- **Returns:** custom/personalized non-returnable unless damaged/wrong; ready-to-ship exchange/refund in short window w/ unboxing video. Disclose before purchase + at checkout.
- **Shipping bulky items:** volumetric weight (L×W×H/5000); snug boxes, compress plush, sleeve bouquets.
- **Character IP:** Disney/Pokémon/Sanrio/Bluey = infringement. Sell originals; decline or clearly handle "inspired" requests.
- **COD / RTO:** COD RTO ~26% vs <2% prepaid, ₹180–240 per failure. Prepaid-first; COD only on ready-to-ship under price cap, COD fee ₹30–50, WhatsApp confirmation before dispatch. Never COD on custom.
- **Transparency:** public order status timeline; WhatsApp + email on every status change.

## 4. Custom order workflow

Form fields: name, WhatsApp, email, category, description, reference images (≤5), colors (swatches + free text), size/measurements, quantity, budget range, needed-by date, occasion, personalization text, gift wrap, delivery pincode, terms checkbox (deposit, no returns, color variance). Plus "customize this product" entry from a PDP (pre-fills base product).

States: `requested → under_review → quoted → (countered ↔ requoted) → accepted → deposit_pending → deposit_paid/in_queue → in_progress (photo updates) → awaiting_approval → balance_pending → ready_to_ship → shipped → delivered → closed`; exits `declined / expired / cancelled`.

Rules: quote expires ~7 days; max 2 counters; quote lists price split, timeline, revisions; every transition notifies (WhatsApp + email); admin Kanban. Etsy model: request → message thread → private reserved listing at agreed price.

## 5. WhatsApp

- `https://wa.me/91XXXXXXXXXX?text=<urlencoded>` prefilled with product name, price, link. Same for "ask about custom", "share order #", "send cart".
- Floating button bottom-right, clear of mobile sticky add-to-cart; hidden on checkout.
- Phase 1: wa.me links + WhatsApp Business app catalog/labels.
- Phase 2: Cloud API utility templates (order confirmed, deposit received, in progress, shipped, delivered/review). ~₹0.115/utility msg India (pricing change 1 Oct 2026 — verify).

## 6. Must-have features

Wishlist (guest localStorage → sync on login), photo reviews + verified badge, gift wrap/note/hide-price, pincode serviceability (Shiprocket) + "Delivers by", coupons + free-shipping progress bar, Shiprocket shipping/tracking, public order tracking, email (Resend/Brevo), SEO + OG images + JSON-LD, Instagram feed/UGC, one-of-a-kind inventory w/ checkout reservation + "Sold — request similar".

Razorpay-required pages: Shipping, Cancellation & Refund, Terms, Privacy, Contact (phone/email/address), visible pricing, About. E-Commerce Rules 2020: seller legal name/address, grievance officer (48h ack / 1 month resolve), origin, price breakup. Privacy per DPDP Act 2023.

## 7. Gen-Z design trends 2025–26

Naive/handmade imperfection, tactile texture, sticker/trinket maximalism, scrapbook collage, expressive display type, bold saturated palettes. Motion ideas: yarn thread SVG drawn on scroll linking sections, squishy spring hover, yarn ball rolling into cart, heart burst on wishlist, sticker-peel reveal for drops, stitch-row progress bar, crochet-hook loader. Respect reduced motion; fast on mid-range Android. Limited drops w/ countdown, maker's desk BTS, reel-style product video.

## Sources

Etsy custom orders help.etsy.com/hc/en-us/articles/115015663107 · WhatsApp click-to-chat faq.whatsapp.com/5913398998672934 · WhatsApp pricing wati.io, whautomate.com · Razorpay website requirements razorpay.com/docs/payments/dashboard/account-settings/business-website-details · E-Commerce Rules acmlegal.org · Shiprocket shiprocket.in/developers · COD/RTO clickpost.ai, hillteck.com · Pricing priceprofittools.com, bhookedcrochet.com · IP madeurban.com, shieldmyshop.com · Prices croise.in, totdot.in, yarniakroshay.in · Trends kittl.com, supercharged.studio
