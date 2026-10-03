# Listing the whales

How to put the whale keychains on the shop through **Admin > Products > New product**. The shop starts with no products; this is the first thing to list. Every field below is on the product page, so a wrong entry is shown to shoppers.

## Before you start

- Photos of **your own** whales, taken by you. The `web/public/maker/` photos are yours; never use stock or someone else's pictures.
- A decision on each colour you will sell (red, yellow, blue, pink) and how many of each are ready, or whether they are made to order.
- Weight of one packed whale in grams (needed for shipping rates).

## The checklist

| Field | What to enter |
|---|---|
| Category | **Keychains** |
| Name | A plain name for your piece, for example "Whale keychain". Do not use the name of any existing cartoon, film or game character, in any field. |
| Price | The **maximum retail price including all taxes** in rupees. This is what the shopper pays for the piece. |
| Previous price | Leave empty unless the whale really sold at that price in the last 30 days at the lowest. It is shown struck through, and the law (from 2027-01-01) requires it to be the lowest price of the previous 30 days. |
| Fulfilment | Ready to ship (stock counted) or made to order (lead time in business days). |
| Colours | One variant per colour with its own stock. Name the colour plainly ("Sunny yellow"). |
| Size and weight | Size in cm and weight in grams, measured on a finished piece. |
| Fibre and care | What yarn it is made of, and how to clean it ("spot clean with a damp cloth"). |
| Net quantity | What the shopper receives, for example "1 piece". Required by the Legal Metrology rules for packaged goods; the product page shows it. |
| Safety note | Optional. If you sell it as a decorative keychain, say so ("Decorative keychain, not a toy. Not for children under 3."). Leave it empty only after you have decided how the piece is classified (see `docs/LEGAL_REVIEW.md`, toy safety). |
| Photos | Your own, 4:5 portrait, at least 2000 px on the long side, at least 2 per product. Write alt text that describes what is seen ("Yellow crochet whale keychain on a wooden table"). |
| Tagline, tags, description | Free of character names. The editor warns you if it finds a well-known one (a guardrail from `web/src/lib/ip-words.ts`, not legal clearance; the list is short and you can extend it). |

## After saving

1. Open the product page on the shop. Check the legal block (net quantity, seller details, safety note), the price and the photos on a phone.
2. The home page whale cards link to the product with the matching colour once it exists; until then they link to the custom work form. Nothing on the home page shows prices, stock numbers or "limited" claims until they exist in the catalogue.
3. Place a test order with a coupon or cash on delivery, then cancel it in admin, so you have seen the whole flow once.

## Do not

- List or advertise pieces that look like existing characters until a lawyer has answered (`docs/LEGAL_REVIEW.md`, section on intellectual property). The whales are your own design and are the safe lane.
- Write "official", "licensed" or "authentic" about any piece.
- Add counts, reviews or "selling fast" lines that are not true.
- Show "baby" or "toy" claims without a safety decision.
