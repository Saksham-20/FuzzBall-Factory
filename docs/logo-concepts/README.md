# Logo concepts (round 2)

Explorations close to the maker's original logo (`web/public/brand/`, unchanged). Drafts, not final: they use white knock-out strokes for over/under crossings and clip paths, so a production version must be flattened to clean paths. Palette: cocoa `#3f2619`, rose `#c98586`, rose-deep `#9c4f55`, rose-wash `#f3dcd8`.

| File | Idea | Strength | Risk |
|---|---|---|---|
| `a-thread-heart.svg` (recommended) | One rose thread crosses into a heart and wraps a real crochet hook | Closest to the original flourish | Thin line, weak at 16px; needs a heavier small-size cut |
| `b-ff-ligature.svg` | High-contrast serif FF sharing one top bar, yarn ball in the crook, thread ending in a heart | Matches the serif wordmark and FF badge | Thread/heart placement still busy; ball detail lost below 32px |
| `c-stitch-ball.svg` | A ball crocheted from V stitches, hook resting on it, loose tail | Best at small sizes; amigurumi/fuzzball idea | Least like the original; no FF or heart |

`concept-sheet.png` shows all three large and at 64/32/16px. `src/gen_*.py` regenerate each SVG (Python 3, no deps) so proportions can be tuned.

Next: pick a direction, then build the kit (flat paths, one-colour and reversed versions, lockups with the wordmark, favicon/app-icon set, usage guide).
