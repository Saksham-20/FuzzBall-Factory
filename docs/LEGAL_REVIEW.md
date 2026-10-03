# Legal review of the policy pages

Written 2026-10-03 from internet research. **This is not legal advice.** Primary sources (the Gazette, meity.gov.in) could not be opened during research, so rule and section numbers come from secondary mirrors and law-firm notes. Confidence tags: **H** several consistent sources, **M** secondary sources only, **L** weak or from memory. Items tagged **[LAWYER]** or **[CA]** need a professional's sign-off before launch. Tasks that act on this review are in `docs/PLAN_LEGAL_SUPPORT_WHALES.md`.

The draft banner (`DraftNote`) stays until the owner confirms a lawyer has reviewed the final text.

## 1. Dates that matter

| Date | What | Conf. |
|---|---|---|
| now | Consumer Protection (E-Commerce) Rules 2020 apply. IT Act s.43A + SPDI Rules 2011 still apply (need a published privacy policy and a grievance officer). DPDP Act: only Board and definitions are in force. | H/M |
| 2026-06-19 | EU Directive 2023/2673: "withdrawal button" for online sales with a withdrawal right. Enforcement against a small Indian maker is unlikely; custom goods are outside withdrawal. | H |
| 2026-07-01 | EU flat EUR 3 customs duty on parcels up to EUR 150 (to 2028-07-01). US de minimis duty-free treatment suspended (since 2025-08-29). Tell buyers duties are routinely due. | H/M |
| 2026-11-13 | DPDP Consent Manager rules start. Not relevant to us. | M |
| **2027-01-01** | **Consumer Protection (E-Commerce) Amendment Rules 2026** in force (notified 2026-09-09). Grievance officer gives the complainant a copy of the complaint as recorded (r.4(5)); National Consumer Helpline convergence mandatory (r.4(7)); "was" price must be the lowest in the prior 30 days (r.4(13)); comply with the 2023 dark-pattern Guidelines and do a yearly self-audit with a displayed certificate (r.4(15)). No small-seller exemption found. | M |
| **~2027-05-13** (some sources say 14) | **DPDP Rules 2025 core duties start** (notice, consent, rights, breach, retention, 1-year security logs). SPDI Rules fall away then. Confirm date in the Gazette. | H/M |

## 2. What the law asks of this store

**E-Commerce Rules 2020 (M).** We are an "inventory e-commerce entity" (own stock, own site). Show legal name, address, website, customer-care contact (r.4(2)); appoint a grievance officer, show name, designation, contacts; acknowledge within **48 hours**, redress within **one month** (r.4(4)-(5)); **no cancellation charge after confirmation** unless we bear the same when we cancel (r.4(8)); consent by explicit action, **no pre-ticked boxes** (r.4(9)); refund in reasonable time (r.4(10)); do not refuse to take back defective, misdescribed or late goods; disclose return, refund, exchange, warranty, delivery, return-shipping cost, payment modes, grievance route and country of origin (r.7). The nodal officer duty is for companies only.

**Consumer Protection Act 2019 (H).** s.2(46) unfair contract: manifestly excessive deposits or penalties disproportionate to loss. s.2(47) unfair trade practice includes refusing to take back defective goods within the period on the bill, or **30 days** if none is stated. s.34(2)(d): the consumer can sue where they live or work; **cannot be contracted out of**.

**Returns on custom goods (H as a position).** No statute gives change-of-mind returns for goods, so "no returns on made-to-order" is lawful. The risk is **forfeiture**: Contract Act s.74 (reasonable compensation only) + CPA s.2(46) + r.4(8). Defensible rule: keep only materials bought and work done, itemised in writing, and bear the same if we cancel. **[LAWYER]**

**Intermediary rules.** A shop selling its own goods is not an intermediary (IT Act s.2(1)(w)); no s.79 safe harbour, no intermediary grievance officer. Reviews and uploads are the only intermediary-like part: low risk, covered by the takedown contact. (M)

**Payments.** Razorpay activation checks: About us, Contact us, **Pricing details**, Terms, Privacy, Refund/Cancellation, and a **sample invoice** (H). A Shipping policy is demanded in practice (M). We must never store card data (H, already true). International card payments for physical goods need an **IEC from DGFT** (M); FEMA realisation and courier export caps unverified (L) **[CA]**.

**GST.** Goods threshold is Rs 40 lakh, but inter-state taxable supply forces registration (s.24(i)) unless the goods are notified handicrafts (Notification 8/2017-IT, up to Rs 20 lakh). Whether crocheted goods are on the list is unconfirmed **[CA]**. An unregistered seller must not show or collect GST and issues a bill of supply. Exports are zero-rated; an LUT needs a GSTIN. (M)

**Legal Metrology (Packaged Commodities) Rules.** r.6(1) declarations (maker name and address, net quantity, MRP inclusive of taxes, consumer-care contact) and r.6(10) makes the e-commerce entity show them on the listing. No handicraft exemption found (L) **[LAWYER]**. Cheap to comply: show them on every product page.

**Dark patterns (H for first ten).** CCPA 2023 Annexure 1: false urgency, basket sneaking, confirm shaming, forced action, subscription trap, interface interference, bait and switch, drip pricing, disguised ads, nagging, trick question, SaaS billing, rogue malware. Keep "only one exists" and any timers literally true; show all fees early.

**International.**
- GDPR Art 3(2) likely applies once we deliver to the EU; Art 27 wants an EU representative (M). UK same. CCPA/CPRA thresholds far above us (H). **[LAWYER]**
- EU/UK: 14-day withdrawal on non-custom goods; Art 16(c) exempts goods made to specification or clearly personalised, read narrowly: catalogue made-to-order with standard options may not qualify (L-M).
- EU GPSR 2023/988 (in force since 2024-12-13): distance-sale listings must show manufacturer name, postal and electronic address and an **EU-established responsible person** (H). Toys for under-14s also need CE/EN 71 (M).
- US: children's products need a CPC from third-party testing; small-batch relief is partial (H).
- India Toys QCO covers products for under-14s; artisans registered with the Development Commissioner (Handicrafts) are exempt (M). **We do not know if the maker holds an artisan card.**
- Safest route: sell as decorative or collector items for adults, if that is genuinely the design and marketing. A disclaimer alone does not decide whether something is a toy. **[LAWYER]**

**IP (material risk).** A crocheted Pokemon-type character is a 3D reproduction or adaptation of a protected work (Copyright Act ss.14, 51). Civil remedies s.55; criminal s.63 is **cognizable and non-bailable**, 6 months to 3 years (Knit Pro v State, SC 2022, H). Trade Marks Act s.29 and ss.103-104. Delhi HC grants platform takedown and John Doe orders for character merchandise (M). A "not affiliated" disclaimer helps against confusion claims; it does **not** cure copyright infringement. Original designs (the whales) are the safe lane. **[LAWYER] before any character-style piece is listed or marketed.** The site must never say licensed, official or authentic for those pieces.

**Cookies.** India has no cookie law; DPDP notice covers it. EU/UK need consent only for non-essential storage. We use essential cookies only (`docs/DATA_RETENTION.md`). Re-assess before adding analytics.

**Records.** CPA complaint limitation 2 years (M); GST records 72 months (M); DPDP security and access logs 1 year (r.6(1)(e), H); breach: tell users without delay and the Board within 72 hours (r.7, H); publish a rights-reply time, at most 90 days (r.14(3), H). Keep the grievance register at least 3 years (our recommendation). A WhatsApp complaint is valid only if copied into the register.

## 3. Page-by-page gaps and fixes

### terms.tsx
1. **Eligibility** says "18 or older, or with a parent". Conflicts with the privacy page; minors cannot contract (Contract Act s.11) and DPDP s.9 needs verifiable parental consent. Fix: "You must be 18 or older."
2. **Liability cap** to "amount you paid" is unenforceable for injury or defects. Replace with:
   > Nothing limits liability for death or personal injury, for a defective product, for fraud, or any right you have as a consumer under the law of your country. Subject to that, our liability for any claim relating to an order is limited to the amount you paid for it.
3. **Safety clause** (not toys under 3): a disclaimer does not decide toy status. Reword per product (see plan task L5). **[LAWYER]**
4. **Custom orders, "advance non-refundable once work has started"** is risky under s.2(46), s.74, r.4(8). Replace with:
   > If you cancel after work has started, we keep only the cost of materials bought and work done for your order, shown to you in writing. If we cancel for a reason not caused by you, we refund everything you paid. If you do not pay the balance within [X] days of our notice, we may cancel the order and the same cost basis applies.
5. **IP section**: add the IP and takedown clause (section 4 below); drop the broad "we do not copy other makers' patterns" representation.
6. **GST/pricing**: placeholder. An unregistered seller must not show GST. Keep the wording switchable on registration status.
7. **Law and disputes**: keep courts at the owner's city and add:
   > This does not stop you from filing a complaint where you live or work (Consumer Protection Act, 2019, s.34(2)(d)). If you live outside India, mandatory consumer protections of your country of residence still apply.
8. **Missing**: severability, entire agreement, electronic contracts (IT Act s.10A), consent to email and WhatsApp contact, force majeure (only in shipping now), account suspension, seller details per r.4(2), optional ODR or mediation.

### refund.tsx
1. Defect window is 7 days for everything. Statutory floor is 30 days for defective goods. Fix: "Tell us within 7 days of delivery about transit damage or a wrong item. For a manufacturing defect, within 30 days. Your statutory rights are not affected."
2. **Unboxing video as a condition** will likely read as unreasonable. Fix: "An unboxing video helps us settle claims with the courier. If you do not have one, send photos and we will still review your claim." Same in shipping.
3. Made-to-order cancellation (24 h then no cancel): pair with r.4(8): no charge before production starts, then costs incurred only.
4. **EU/UK buyers** get 14-day withdrawal on non-custom items. Add:
   > If you live in the EU or UK, you can withdraw from a purchase of non-personalised items within 14 days of receiving them (return shipping is paid by you). Items made to your specification or clearly personalised are excluded (Directive 2011/83/EU, Art 16(c)).
5. International currency-difference clause is fine; confirm what Razorpay actually refunds.
6. "Replacement, repair or refund" at the seller's choice becomes the buyer's choice where repair or replacement is not possible (r.7).

### shipping.tsx
Add: risk of loss stays with us until delivery; EU EUR 3 duty and US de minimis suspension as examples of charges; EU responsible-person details for EU shipments; prohibited destinations and sanctions line; refusal refunds apply only where the refusal is not our fault; remove the unboxing-video condition.

### privacy.tsx (strong draft)
1. Log retention: the page says IPs drop after 30 days; DPDP r.6(1)(e) wants security logs kept 1 year from ~May 2027. Keep today's wording accurate now; change code and wording together in the May 2027 task (T-DPDP in the plan).
2. Notice must stand alone at each collection point (signup, checkout, work-order form, support form), with how to withdraw consent and complain to the Board. Withdrawal must be as easy as giving consent (in-account control).
3. Children: 18+ only (matches terms).
4. Name processors: Razorpay (own fiduciary), Resend, courier, host (uploaded photos are stored on our own server since 2026-10-04; add Cloudinary only if it is switched on). Link each one's policy. Not yet verified.
5. Add a GDPR/UK addendum: lawful bases, Art 15-22 rights, supervisory-authority complaint, Art 27 representative (once decided). **[LAWYER]**
6. Keep policy and grievance officer live now (SPDI Rules 4-5).
7. Retention periods (orders about 8 years) **[CA]**; **support tickets are new data** (plan task S1 adds a row).
8. The page promises a marketing opt-in that the UI does not have. Delete the promise (no marketing at launch) or build an unticked box.
9. WhatsApp marketing needs explicit opt-in; keep transactional separate.

### grievance.tsx
Timings are right. Use "We will resolve your complaint within one month" (not "tell you what we found"). Add: copy of the complaint as recorded (from 2027-01-01), National Consumer Helpline partnership, customer-care phone and email separate from the officer, officer name and designation, dark-pattern audit certificate slot (show only after an audit exists, never invent it).

### faq.tsx
Review "Are the plushies safe for babies?" against the toy-safety decision. Add: "Do you make official or licensed characters? No." / "Can you copy [character]? No." / an EU/UK withdrawal question.

### Missing pages
Pricing details (Razorpay); IP and takedown policy; complete About and Contact (address, phone, email); sample invoice (Razorpay); per-product safety and manufacturer block for EU.

## 4. New clause: IP and takedown (page `/policies/ip`) **[LAWYER]**

> FuzzBall Factory is an independent studio. Our designs are original handmade work. We are not affiliated with, endorsed by or licensed by any game, anime, film, television or toy company. We do not sell official or licensed merchandise, and we do not accept orders to copy named characters or logos. If you believe anything on this site infringes your copyright or trademark, write to [IP contact email] with: your name and contact details; the work you own and proof of ownership; the URL of the item; a statement that you have a good-faith belief it is unauthorised; and a statement that your information is accurate. We acknowledge within 48 hours, review within [7] days, and remove or suspend a listing where the notice appears valid. We keep a record of each notice and outcome. If you believe a removal was a mistake, you can reply with a counter-notice.

Product-level line: "Original handmade design. Not an official product."

## 5. Not verified (do not treat as fact)
- Gazette text of the 2026 E-Commerce Amendment; any small-seller carve-out.
- Exact DPDP commencement (13 vs 14 May 2027); any shortening.
- Rule numbers for E-Commerce Rules 4 and 7 (mirrors disagree).
- Crochet goods on the GST handicraft list; FEMA realisation period and courier export caps.
- Whether Legal Metrology exempts handcrafted items.
- Resend, Razorpay and the hosting provider's data-processing terms.
- Artisan card status (decides Toys QCO exemption).
- Any case law on unboxing-video preconditions (none found).

## 6. Lawyer and CA sign-off checklist

1. Final text of all six policy pages plus Pricing and IP.
2. Forfeiture and cancellation rule for custom orders (deposit kept = costs only).
3. Whether character-style pieces may be sold or marketed at all. Until answered, do not list them.
4. Toy-safety classification of plush and keychains; labels per market; whether to ship plush to EU/US.
5. GDPR Art 27 representative and GPSR responsible person (or stop shipping to the EU).
6. Legal Metrology listing declarations.
7. Jurisdiction clause and consumer-rights savings wording.
8. **[CA]** GST registration, handicraft exemption, LUT, invoice format, export (IEC, FEMA) steps, record retention.
