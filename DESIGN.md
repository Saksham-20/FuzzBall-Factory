---
name: FuzzBall Factory
description: Handmade with love. A crochet store built as a tiny handmade factory, where the production line is the order status.
colors:
  cocoa: "#3f2619"
  brown: "#6b4228"
  brown-soft: "#8a6249"
  cream: "#f6eee3"
  paper: "#fcf8f2"
  kraft: "#d4ae80"
  kraft-light: "#e8d3b4"
  kraft-deep: "#a8804f"
  butter: "#f4cd52"
  butter-deep: "#d9ab1f"
  rose: "#c98586"
  rose-deep: "#9c4f55"
  rose-wash: "#f3dcd8"
  ok: "#466e3d"
  ok-wash: "#e1ecd6"
  warn: "#8a5d08"
  warn-wash: "#faeccb"
  err: "#a8322d"
  err-wash: "#f7dcd8"
  line: "color-mix(in oklab, #6b4228 18%, transparent)"
  line-strong: "color-mix(in oklab, #6b4228 34%, transparent)"
typography:
  display:
    fontFamily: "Modak, 'Arial Rounded MT Bold', ui-rounded, sans-serif"
    fontSize: "clamp(3.1rem, 9.4vw, 7.5rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Modak, 'Arial Rounded MT Bold', ui-rounded, sans-serif"
    fontSize: "clamp(2.5rem, 5.6vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Big Shoulders Stencil', Figtree, ui-sans-serif, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.07em"
rounded:
  stamp: "6px"
  photo: "10px"
  field: "12px"
  ticket: "14px"
  pill: "9999px"
spacing:
  gutter: "16px"
  gutter-md: "32px"
  gutter-lg: "48px"
  conveyor: "44px"
  conveyor-md: "104px"
components:
  button-primary:
    backgroundColor: "{colors.cocoa}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.brown}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.cocoa}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 24px"
  button-tape:
    backgroundColor: "{colors.butter}"
    textColor: "{colors.cocoa}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 24px"
  button-tape-hover:
    backgroundColor: "{colors.butter-deep}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.cocoa}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "0 16px"
  ticket:
    backgroundColor: "{colors.kraft-light}"
    textColor: "{colors.cocoa}"
    rounded: "{rounded.ticket}"
    padding: "10px"
  badge-ready:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-made-to-order:
    backgroundColor: "{colors.warn-wash}"
    textColor: "{colors.warn}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-one-of-one:
    backgroundColor: "{colors.butter}"
    textColor: "{colors.cocoa}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  tab-active:
    backgroundColor: "{colors.cocoa}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 16px"
  tape-toggle:
    backgroundColor: "{colors.cocoa}"
    textColor: "{colors.butter}"
    rounded: "{rounded.pill}"
    size: "24px"
---

# Design System: FuzzBall Factory

## Overview

**Creative North Star: "The Factory Floor"**

The store takes its name literally: a tiny, cozy factory where yarn goes in and fuzzballs come out, and the production line is the order status. Every surface is a material from that floor. Cream paper is the ground, cocoa is the ink, job tickets are kraft with a punched hole, statuses are rubber stamps, and butter tape holds things down. One live thing moves through it all: the dusty rose yarn thread, which leaves the hero's yarn ball and runs down the page through numbered stations.

Density follows the job. The home page persuades, with big display type, giant cropped category words and room around each station. Shop, checkout, account and admin work in tighter layouts inside the same world, where the brand lives in the details: stencil labels, batch numbers, stamps and tickets rather than decoration. The world is a pastel boutique's opposite: no photo carousel, no row of category circles, no testimonial slider.

Everything is made by one pair of hands, and the system is built to say so honestly. Lead times, sizes and fibres sit on the tickets. Sample content is labelled as sample, and nothing invents reviews, counts or press.

**Key Characteristics:**
- Paper goods on a workbench: kraft tickets, rubber stamps, butter tape, a yarn ball.
- One rose thread, the only live colour, carries the eye down the page.
- A bubbly display voice (Modak), a friendly sans (Figtree) and factory stencil labels (Big Shoulders Stencil).
- Statuses as named stamps, each family with its own shape.
- Motion that shows the making (thread drawing, stamps landing, a swinging ticket) and stops for reduced motion.

## Colors

A warm, papery palette: ink and paper carry almost everything, butter is the one loud accent, and rose is rationed to the thread and the active state.

### Primary
- **Cocoa Ink** (`cocoa`): body text, headings, primary buttons, stamp ink, the active tab and the footer ground.

### Secondary
- **Butter Tape** (`butter`, hover `butter-deep`): the one loud accent. The tape strip, tape-style buttons, the WhatsApp chip, the "One of one" badge, text selection, and the focus ring on cocoa surfaces.

### Tertiary
- **Dusty Rose Thread** (`rose`): the yarn thread and yarn-ball glyphs.
- **Deep Rose** (`rose-deep`): the live state. The station node the thread has reached, the live step on timelines, field focus borders, the focus ring on light grounds, the caret and native form accents.
- **Rose Wash** (`rose-wash`): the halo around a live timeline step.

### Neutral
- **Cream Paper** (`cream`): the page ground, and text on cocoa.
- **Paper** (`paper`): fields, secondary buttons, paper tickets and cards that sit on kraft.
- **Kraft Ticket** (`kraft-light`, `kraft`, `kraft-deep`): job tickets and kraft panels (`kraft-light` base with two soft tints), stencil headings in the footer, scrollbar thumbs, peg wood.
- **Brown** (`brown`) and **Soft Brown** (`brown-soft`): secondary text, ticket heads, hints and placeholders.
- **Line** (`line`, `line-strong`): dividers, and field and radio-card borders.

### Status
- **Ready Green** (`ok` on `ok-wash`): ready to ship, paid, success messages. 4.8:1 on its wash.
- **Workshop Amber** (`warn` on `warn-wash`): made to order and waiting states. 4.9:1 on its wash.
- **Stamp Red** (`err` on `err-wash`): errors, invalid fields, cancelled orders and declined work orders. 5.1:1 on its wash.

### Named Rules
**The One Live Thing Rule.** Rose appears only on the yarn thread and on active state. It never decorates, and it is never a second accent.

**The Loud Butter Rule.** Butter is the only loud colour. Keep it to small areas: tape, a chip, a badge, a selection.

**The Ring Contrast Rule.** A focus ring keeps 3:1 against the surface it sits on: rose-deep on paper and cream, butter on cocoa (every cocoa surface sets `--focus-ring` to butter).

## Typography

**Display Font:** Modak (with Arial Rounded MT Bold, ui-rounded)
**Body Font:** Figtree (with ui-sans-serif, system-ui)
**Label Font:** Big Shoulders Stencil, weights 600 and 800 (with Figtree)

**Character:** A chunky, bubbly display voice that looks stuffed with yarn, against a clean, friendly sans. Stencil labels stamp batch numbers, stations and statuses like markings on factory crates.

### Hierarchy
- **Display** (400, clamp(3.1rem, 9.4vw, 7.5rem), 0.92): the hero line. The shelf's giant cropped category words go further, up to clamp(3.75rem, 14.5vw, 11.5rem).
- **Headline** (400, clamp(2.5rem, 5.6vw, 4.5rem), 0.92): section headings. Smaller steps at clamp(1.875rem, 4.2vw, 2.5rem) and clamp(2rem, 4vw, 3rem) for subsections.
- **Title** (700, 1.0625rem, 1.375, -0.01em): product names on tickets.
- **Body** (400, 16px, 1.5): reading copy. 15px for dense lists and footer links.
- **Label** (800, 12px, 0.07em, uppercase): ticket heads, station tags and footer headings. 11px in badges, 11px in ticket heads in two-up phone grids.

Headings balance their lines and paragraphs avoid orphans (`text-wrap: balance` and `pretty`). Batch, order and work-order numbers use tabular numerals.

### Named Rules
**The Stencil Is Signage Rule.** Stencil type labels things: batch numbers, stations, statuses, badges. It never sets a sentence.

**The No Eyebrow Rule.** No small label sits above a heading. The heading carries its own weight.

## Layout

Content sits in a centred shell up to 1280px wide, with side gutters of 16px on phones, 32px from 768px and 48px from 1024px. On the home page a conveyor column is kept free on the left for the yarn thread: content that the thread runs past is indented 44px (104px from 768px), and numbered station nodes sit on the thread.

Breakpoints are Tailwind's defaults (640, 768, 1024, 1280px) plus one of the project's own: station tickets pin while scrolling only on screens at least 1024px wide and 736px tall, so a shorter laptop scrolls them rather than pinning one half off screen. Hover effects apply only on devices that really hover.

The layout is mobile-first for mid-range Android phones and never scrolls sideways, down to 320px. Grids of product tickets run two-up on phones.

## Elevation & Depth

Paper objects on a table. Depth comes from two soft, warm shadows with real offset and blur, tinted with cocoa rather than grey. Tickets rest with a low shadow and lift when pointed at. Nothing glows. The one translucent surface is the sticky header, which frosts over the page once you scroll.

### Shadow Vocabulary
- **Ticket** (`box-shadow: 0 1px 1px rgb(63 38 25 / 0.06), 0 6px 18px -6px rgb(63 38 25 / 0.22)`): tickets and secondary buttons at rest.
- **Lift** (`box-shadow: 0 2px 2px rgb(63 38 25 / 0.06), 0 18px 36px -14px rgb(63 38 25 / 0.32)`): pointed-at tickets and secondary buttons, the floating WhatsApp button, drawers, dialogs, menus and admin action bars.
- **Tape edge** (`box-shadow: 0 2px 0 rgb(63 38 25 / 0.08)`): the thin edge under the tape strip.
- **Scrolled header** (`box-shadow: 0 1px 0` in `line`): the hairline under the sticky header, with a medium backdrop blur over 92% cream.

### Named Rules
**The Table Rule.** A surface either rests on the paper or lifts off it. No glow and no coloured halo.

## Shapes

- **Tickets:** 14px corners, 10px padding, and a punched hole: an 8px circle of the ground colour at the top centre with a soft inset shadow. Kraft bands carry perforated edges (half-punched holes along the top and bottom).
- **Pills:** buttons, badges, tabs and chips are fully rounded.
- **Fields:** 12px corners with a 1.5px border.
- **Photos:** 10px corners inside a ticket.
- **Stamps:** a 6px rectangle, a 74px circle or a dashed ticket, set at a slight tilt (-4° by default).
- **Tape:** a straight strip tilted -1.2°. Short tape pieces that pin paper have torn ends.
- **The yarn ball:** an SVG sphere wrapped in three bands of strands, tintable to any colour.

## Components

Paper goods you could pick up off the workbench: tickets with punched holes, rubber stamps, tape. Soft shadows, a small lift on hover, a small press on click.

### Buttons
- **Shape:** pill. Three sizes: 36px tall with 16px sides (14px text), 44px with 24px (15px text), 52px with 32px (16px text). Semibold.
- **Primary:** cocoa with cream text; hover turns brown.
- **Secondary:** paper with cocoa text on a ticket shadow; hover lifts.
- **Tape:** butter with cocoa text; hover deepens to butter-deep.
- **Ghost:** cocoa text; hover lays an 8% cocoa wash.
- **Press:** everything pressable scales to 0.97 over 160ms (`cubic-bezier(0.23, 1, 0.32, 1)`).
- **Focus:** a 2.5px ring 3px outside the button, rose-deep, or butter on cocoa.

### Chips
- **Badges:** 11px stencil labels on a pill with a wash: Ready to ship (green), Made to order with its lead time (amber), One of one (butter), Sold (cocoa with cream text). A dashed "Sample" badge marks sample products while the site runs on sample data.
- **Tabs:** pill triggers, 44px tall, 15px semibold brown text; the active tab fills cocoa with cream text.

### Cards / Containers
- **Corner Style:** tickets at 14px (see Shapes).
- **Background:** kraft by default, or paper when the ticket sits on a kraft field.
- **Shadow Strategy:** Ticket at rest, Lift on hover (see Elevation & Depth).
- **Internal Padding:** 10px.
- **Head:** a row of stencil labels above the content (a batch number on the left, a label or badge on the right). It never wraps: a text label gives way before a badge does, and truncates with an ellipsis.

### Inputs / Fields
- **Style:** paper fill, 1.5px `line-strong` border, 12px corners, 48px tall, 16px sides, 16px text (so phones don't zoom). Placeholders in soft brown.
- **Focus:** the border turns rose-deep.
- **Error / Disabled:** an error turns the border red and shows the message with an icon under the field; disabled fields fade to 55%.
- **Choices:** radio options are paper cards (12px corners) whose border turns cocoa when checked; checkboxes are 20px with 6px corners, in cocoa.

### Navigation
- **Header:** sticky; the logo on the left, the main links from 1024px, icon buttons on the right (a deep rose dot on the wishlist once something is saved). It frosts over the page once you scroll.
- **Mobile menu:** full screen, with links set in the display face.
- **Footer:** the one cocoa band, with stencil column headings in kraft, kraft-light links, a butter WhatsApp chip and butter focus rings.

### Rubber Stamps
Statuses are stamps: a stencil label inside a 2px border with a 1.5px inner outline, inked in the status colour with a multiply blend so the paper shows through, and tilted. Each status family has its own shape (rectangle, circle or dashed ticket), so colour is never the only signal.

### The Yarn Thread and Stations
The signature interaction. A rose thread leaves the hero's yarn ball, curls to the left gutter and is drawn down the page as you scroll, through numbered station nodes; the node the thread has reached turns deep rose. On order timelines the thread's stroke tells the state: solid rose for done, a marching dash for in progress, dotted kraft for still to come, and a loose curl when the next move is the customer's.

### The Tape
A butter strip of stencil words with yarn-ball glyphs between them, tilted -1.2° and looping right to left at a slow, constant speed (42s per pass, linear). Pointing at the words holds them still. A 24px cocoa pause button with a butter glyph rides the tape at the left content edge, clear of the WhatsApp button, and its choice is remembered across pages. Under reduced motion the tape stands still and the button is gone.

### Motion
Entrances and UI use a strong ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`), on-screen movement a strong ease-in-out (`cubic-bezier(0.77, 0, 0.175, 1)`), drawers `cubic-bezier(0.32, 0.72, 0, 1)`. Blocks reveal once as they scroll in (fade and a 16px rise over 600-700ms); the hero lines rise in turn 70ms apart; the batch ticket swings from its hole and settles. Under reduced motion loops stop and every reveal shows whole.

## Do's and Don'ts

### Do:
- **Do** keep rose for the yarn thread and active state only.
- **Do** show every status as a named stamp with its own shape, never by colour alone.
- **Do** set `--focus-ring: var(--color-butter)` on any cocoa surface.
- **Do** keep small text on washes and butter at 4.5:1 or better (Ready to ship is `ok` #466e3d on `ok-wash`, 4.8:1).
- **Do** set batch, order and work-order numbers in stencil labels with tabular numerals.
- **Do** put hover effects only on devices that hover, and give every press a 0.97 scale.
- **Do** give every looping motion a way to stop, and stop it under reduced motion.
- **Do** label sample photos and products as samples until the maker's own arrive.

### Don't:
- **Don't** put an eyebrow label above a heading.
- **Don't** use gradient text or emoji as icons.
- **Don't** invent reviews, order counts or press.
- **Don't** build the pastel boutique: photo carousel, row of category circles, testimonial slider.
- **Don't** use rose as a second accent or as decoration.
- **Don't** set sentences in the stencil face.
