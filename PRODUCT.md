# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed 2026-09-21: Next.js (App Router, TypeScript, Tailwind v4) storefront + account + admin in `web/`; NestJS + Prisma + PostgreSQL API in `api/`, trimmed from HomeKrafted's modules. UI first on a typed mock layer, backend after. See `docs/PLAN.md`.

## Users

- **Shoppers (primary):** Gen-Z and young millennials (roughly 16–30), mostly in India, some international. Arrive from Instagram reels, WhatsApp shares and Pinterest, usually on a phone. Buying cute handmade pieces for themselves or, very often, as gifts (birthdays, Valentine's, anniversaries, rakhi, graduations).
- **Custom requesters:** shoppers who want a piece made to their idea, or an existing product changed (colour, size, name, details), and want to state a budget and negotiate a price.
- **The maker/admin (one person):** crochets every piece, lists products, answers queries (largely on WhatsApp), quotes custom requests, accepts/rejects/counters them, and ships orders.

## Product Purpose

Online store for FuzzBall Factory's handmade crochet products. Shoppers buy ready pieces, or request commissions and customizations with a quote conversation the maker can accept, counter or reject. Success: shoppers trust a handmade product they can't touch, understand lead times before paying, and custom requests move from idea to paid order without getting lost in WhatsApp threads.

## Positioning

Every piece is crocheted by one maker's hands, so nearly everything is either one-of-a-kind or made to order. The store is built around that truth: made-to-order lead times are shown up front, and customization/commissioning is a first-class path with a transparent quote → deposit → progress → ship flow, not a "DM us" afterthought.

## Operating Context

- WhatsApp is the primary conversation channel; the site links into it with prefilled context (product, order, custom request).
- Payments: Razorpay (UPI, cards, netbanking) plus Cash on Delivery for ready-to-ship items only. Custom orders: 50% advance after quote acceptance, balance before shipping. Never COD on custom work.
- Ships within India and internationally (INR primary; international shipping rates needed).
- Admin works from a phone as often as a laptop.

## Capabilities and Constraints

- Accounts: signup, login, user dashboard (orders, custom requests, addresses, wishlist, profile). Admin dashboard (products, orders, custom requests, users, coupons, content).
- Catalogue: categories (e.g. bouquets & flowers, keychains & charms, plushies/amigurumi, bags, wearables, hair accessories, home decor, baby, gifting/hampers), variants (colour, size), stock including qty-1 one-of-a-kind items, ready-to-ship vs made-to-order with lead time.
- Custom orders: new request or "customize this product", reference images, colours, size, budget/quote, needed-by date; admin quote/counter/accept/reject; status timeline with progress photos.
- Policies required for Razorpay and Indian E-Commerce Rules 2020: shipping, cancellation & refund, terms, privacy, contact, grievance officer, country of origin.
- Character/IP-licensed designs must not be sold; original designs only.
- Undecided: exact product list and prices, shipping partner/rates (Shiprocket suggested), international shipping rate model, WhatsApp number, legal entity details.

## Brand Commitments

- Name: **FuzzBall Factory**. Tagline: **"Handmade with love"**. Stamp line: "Cozy crocheted goods".
- Logo assets (user-supplied): primary wordmark — chocolate-brown high-contrast serif "FuzzBall", spaced "Factory", dusty-rose yarn thread looping into a heart ending at a crochet hook; "FF" monogram with yarn ball and heart; kraft circular stamp; rose circular badge.
- Logo colours are binding for brand marks: chocolate brown, dusty rose, cream/off-white, kraft.
- User asks for the site to feel modern, new, unique and Gen-Z, with animated yarn and crochet hooks and scroll-driven motion.

## Evidence on Hand

- Logo images only (need to be saved into the repo as files).
- No product photos, prices, reviews, testimonials, order counts or press yet. None of these may be invented; placeholders must be labelled as samples.
- Domain research: `docs/research-brief.md`.

## Product Principles

1. Handmade truth first: show lead time, fiber, size in cm and colour variance before the buy button, not after.
2. Custom is a front door, not a side door: requesting or customizing is as easy as adding to cart.
3. Every order has a visible status; the maker never has to answer "where is my order?" by hand.
4. WhatsApp-native: every question path lands in a prefilled chat.
5. Prepaid-first, fair to a solo maker: deposits for custom work, COD only where the risk is small.

## Accessibility & Inclusion

Mobile-first on mid-range Android over variable networks. Motion-heavy brand must respect `prefers-reduced-motion`. WCAG AA contrast for text on brand colours.
