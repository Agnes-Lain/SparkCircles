# SPARKCIRCLES — Design System v1.3
> The Sober Unicorn · Design reference for the whole product team

---

## Product context

**SPARKCIRCLES** is a logistics ecosystem for parents combining:
- **Event searching, creation, participation & recommendation**: Help families find, organize and join outings, snack gatherings, and cultural and sports activities, with suggestions tailored to their family and neighborhood.
- **Community builder**: Create small groups of nearby families who organize daily life together. Each community comes with shared services, starting with:
  - **Shared routine builder**: Parents coordinate recurring tasks, such as school pick-ups, and take turns based on each person's availability.
  - **More services to come**: The list is intentionally open, so new shared services can be added to communities over time.
- **Verified marketplace**: Find trusted childcare solutions and services.
- **Vacation house exchange**: Let families swap homes for holidays, so they can travel more easily and affordably while staying in a family-friendly home.

**Key user insight** (survey of 80 respondents, FR+EN, Feb. 2024):
- 84% of parents feel tired "sometimes" or "often"
- Pain point #1: Socializing / organizing events with other parents (score 2.47/3)
- Pain point #2: Organizing vacations & travel (2.40/3)
- Pain point #3: Daily routine & childcare (2.27/3, tied)

**Core UX goal**: Reduce mental load while creating a joyful universe for the child.

---

## Changelog

**v1.3 (October 2, 2026)** — requested by the PM, after review of the "Accounts and verification" design
- **Primary CTA is now green**: Fresh green **Base** `#A5E07F` fill with **Ink** text (11.25:1, contrast rule 2). Violet is no longer the CTA color. *(Adjusted after PM feedback: white on Dark green felt too strong. Dark green `#2F7A1F` stays for green text and meaningful non-text elements: links, Secondary/Ghost labels and borders, focus, check icons, "Verified ✓" text, checked checkbox.)*
- **Primary button states redefined**: hover keeps opacity 0.9; pressed adds a 1.5px green-dark inset border; disabled becomes a Shell fill with a dashed Ink 3 border and Ink 3 text (no more opacity 0.4 for Primary).
- **Recommendations stay lavender** ("Recommended" badge, Recommendation notification): confirmed by the PM.
- **The Violet family is renamed "Lavender"** (same hexes) and becomes the **Home** color. **Events becomes Fresh green.** Community (sky), Market (pink) and Travel (yellow) are unchanged.
- **"Verified ✓" badge is green** everywhere (members, families, providers). Pink no longer means "verified".
- **Success / confirmation icons are green** (check icon in green Dark).
- **New Error color** (Light `#FDECEC`, Base `#F4A6A6`, Dark `#B42318`), used only for errors, field error states and destructive actions, always with an icon + text.
- **New Destructive button** (Error Dark, white text, leading icon).
- **Neutral badge** added ("Not verified" and other neutral statuses).
- **Form controls**: input and checkbox borders darkened to Ink 3 (meets 3:1 for controls); new specs for field labels, helper and error text, checkbox and radio list.
- **New patterns** formalized: header with back button, toast, scrim, neutral icon square, avatar entry to "My account" on Today, step counter, capture frame, status timeline, wordmark, language switch, success checkmark for account events.
- **Cross-module screens** (account, settings, auth) use the neutral base, no module accent.
- **Admin** is a separate web back office (not in the mobile app); its desktop layout rules are still open (section 18).

**v1.2 (October 2, 2026)** — validated by the PM on the "Today" dashboard mockup
- New **rainbow palette of five accents** (sky, cotton pink, fresh green, violet, sunny yellow), one per tab. Replaces lavender / mint / peach / lemon.
- **Module → color mapping changed** (section 1).
- **Contrast fixes**: Ink 3 darkened to `#6E6E6E`; all "dark" variants re-derived so every text/background pair passes WCAG AA.
- **Filled elements rule**: active tabs, chips and fills use the bright *base* color with *ink* text. White text is only used on *dark* variants (primary buttons).
- **Peach "Danger CTA" removed** (read as an alarm). Primary CTA is violet.
- **Icons**: line icons replace emoji inside cards. Emoji remain only in empty-state illustrations and celebration micro-interactions.
- **Notifications**: tinted cards with a colored dot; the colored left border is removed.
- Tab bar active state redefined (section 10).

---

## 1. Color palette

### Guiding principle — "The Sober Unicorn"
Vibrant pastels are reserved for **accents** (badges, illustrations, icons, active tabs, highlights).
Structure and layouts stay on **soothing neutrals**.
Critical text (times, names, alerts) is always in **ink / very dark gray** for instant readability.

### The five accents

Each accent has three stops: **Light** (backgrounds), **Base** (fills), **Dark** (text on light backgrounds, and fills that carry white text).

| Name | Light | Base | Dark | Module (tab) |
|---|---|---|---|---|
| **Lavender** *(was "Violet")* | `#EDE9FD` | `#C5B8F5` | `#6B5BC4` | Home |
| **Fresh green** | `#E6F7DD` | `#A5E07F` | `#2F7A1F` | Events |
| **Sky** | `#E3F3FD` | `#8FD3F7` | `#1F6FA8` | Community (incl. shared routine) |
| **Cotton pink** | `#FFEEF5` | `#FFB6D3` | `#B03A78` | Market |
| **Sunny yellow** | `#FFF6CC` | `#FFD93D` | `#8F5E00` | Travel |

### Error color (not a module accent)

| Name | Light | Base | Dark | Usage |
|---|---|---|---|---|
| **Error** | `#FDECEC` | `#F4A6A6` | `#B42318` | Errors, field error states and destructive actions only |

Rules: Error is **never decorative** and never identifies a module. It is always paired with an icon (`alert-circle` for errors, the action's icon for destructive buttons) **and** text that says what to do; color is never the only signal.

### Neutral base

| Name | Hex | Usage |
|---|---|---|
| **Shell background** | `#F8F7F4` | App background — slightly warm off-white |
| **Surface** | `#FFFFFF` | Cards, modals, drawers |
| **Border** | `rgba(0,0,0,0.08)` | Separators, card outlines (decorative only, not for controls) |
| **Ink** | `#1A1A1A` | Primary text — times, names, critical data |
| **Ink 2** | `#4A4A4A` | Secondary text — labels, descriptions |
| **Ink 3** | `#6E6E6E` | Tertiary text — metadata, captions; **borders of inputs, checkboxes and radios** |
| **Scrim** | `rgba(26,26,26,0.4)` (Ink at 40%) | Dimmed background behind bottom sheets and modals |

### Contrast rules (WCAG AA, informational text ≥ 4.5:1, controls ≥ 3:1)

1. **Text on an accent's Light background** → always the **Dark** variant of the same accent.
2. **Filled element in a Base color** (active tab, chip, avatar fill) → **Ink** text.
3. **White text** → only on a **Dark** variant (e.g. destructive button, checked checkbox icon).
6. **Base colors are fills, never signals on white**: a Base color against Surface/Shell is below 3:1 (green Base on Surface 1.55:1), so it is never used for text, icons, borders or focus on white. Use the Dark variant there.
4. Never pure black `#000000` on a colored background.
5. **Control boundaries** (input, checkbox, radio) → Ink 3 border (5.1:1 on Surface). The soft `Border` token is only for decoration and separators.

Measured ratios (WCAG 2.x formula):

| Accent | White on Dark | Dark on Light | Ink on Base |
|---|---|---|---|
| Lavender | 5.36 | 4.51 | 9.57 |
| Fresh green | 5.35 | 4.77 | 11.25 |
| Sky | 5.4 | 4.75 | > 10 |
| Cotton pink | 5.6 | 5.05 | > 10 |
| Sunny yellow | 5.6 | 5.12 | > 12 |
| **Error** | **6.57** | **5.76** | **8.99** |

Other measured pairs: Ink on green Base 11.25 (Primary button); green Base on Surface 1.55 / Shell 1.44 (fill only, never a signal); green Dark against green Base 3.46 (pressed border); green Dark on Surface 5.35, on Shell 4.99 (links, ghost buttons, focus); Error Dark on Surface 6.57, on Shell 6.14 (field error text); Ink 3 on Surface 5.1 (control borders, captions), on Shell 4.76.

### Color semantics in the UI
Module colors identify **where you are**. Status colors always take priority on badges and notifications.

```
Green    → Events + primary action (CTA) + success: "Confirmed ✓", "Covered ✓", "Available", "Verified ✓"
Lavender → Home, recommendations, "New"
Sky      → Community, shared routine, "you" on a turn
Pink     → Marketplace
Yellow   → Travel + soft alerts: reminders, "Needs a volunteer", "Your turn soon", "Pending"
Error    → errors, field errors, destructive actions (not a module)
Neutral  → "Not verified", inactive or neutral statuses
```

### Module accents
Used for **illustrations, empty-state backgrounds, card accent bars and the tab bar**.

| Module | Accent | Where it appears |
|---|---|---|
| **Home** | Lavender | Dashboard greeting accents, Home tab |
| **Events** | Fresh green | Event cards, empty state, Events tab |
| **Community** (incl. shared routine) | Sky | Community cards, routine card accent, empty states |
| **Marketplace** | Cotton pink | Provider cards, search empty state |
| **House exchange / Travel** | Sunny yellow | Home cards, exchange empty state |

**Cross-module screens** (account, settings, sign-up, login, verification) use **no module accent**: Shell background, Surface cards, Ink text, green Primary CTA, and status colors only where they carry meaning.

---

## 2. Typography

**Typeface**: System sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`) — native, fast, readable.
**Weights used**: 400 (regular) and 500 (medium) only. Never 600/700 — too heavy on pastel backgrounds.

### Type scale

| Role | Size | Weight | Line-height | Usage |
|---|---|---|---|---|
| **H1** | 28px | 500 | 1.2 | Greeting, main page title |
| **H2** | 20px | 500 | 1.3 | Section title |
| **H3** | 16px | 500 | 1.4 | Subtitle, card title, activity name |
| **Body** | 14px | 400 | 1.6 | Regular content, descriptions, field labels |
| **Caption** | 12px | 400 | 1.5 | Metadata, timestamps, secondary info, helper and error text |
| **Label** | 11px | 500 | 1.4 | Uppercase section headers + letter-spacing 0.06em (use Ink 2) |
| **Data display** | 32px | 500 | 1.0 | Times, key numbers (08:30, 3 families) |

### Typographic golden rule
> The time and place of every activity, and **who is on duty**, must be readable **in under one second**, even by an exhausted parent at 7 a.m.

Always use `Data display (32px / 500)` for the next upcoming time, and never go below 16px for activity names or the name of the parent on duty.

### Wordmark
Until a logo exists, the wordmark is "SPARKCIRCLES" in H1 (28px/500), Ink, used on the Welcome screen only.

---

## 3. Spacing

System based on a **4px** grid.

| Token | Value | Usage |
|---|---|---|
| `space-xs` | 4px | Minimal internal gap (icon + text, label + field) |
| `space-sm` | 8px | Gap between elements on the same row |
| `space-md` | 12px | Gap between rows within a card |
| `space-lg` | 16px | Internal card padding, screen side padding |
| `space-xl` | 24px | Gap between sections |
| `space-2xl` | 32px | Margin between major blocks |
| `space-3xl` | 48px | Bottom page padding (tab bar clearance) |

---

## 4. Border radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 8px | Tags, small inner badges, icon squares, checkboxes |
| `radius-md` | 12px | Inputs, selects, small chips, tab buttons, image tiles |
| `radius-lg` | 16px | Cards, panels, list items, notifications, toasts, capture frame |
| `radius-xl` | 24px | Modals, bottom sheets, large hero cards |
| `radius-pill` | 100px | All buttons, main badges |
| `radius-full` | 50% | Avatars, round icons, radios, camera shutter |

---

## 5. Components — Buttons

### Variants

```
Primary     → bg: green-base (#A5E07F) · text: ink (#1A1A1A) · radius: pill
Secondary   → bg: green-light (#E6F7DD) · text: green-dark · radius: pill
Ghost       → bg: transparent · border: 1.5px green-dark · text: green-dark · radius: pill
Module CTA  → bg: module base · text: ink · radius: pill (e.g. empty states)
Destructive → bg: error-dark (#B42318) · text: white · leading line icon · radius: pill
```
**Destructive** is only for irreversible or account-level actions (e.g. "Close my account"), always after an explanation of the consequences and paired with a Ghost "Keep…" / "Cancel" alternative. It is never the default focus.

### Sizes

```
Large   → padding: 14px 28px · font: 15px/500
Default → padding: 10px 20px · font: 14px/500
Small   → padding: 7px 14px  · font: 12px/500
```
Minimum height 44px for every tappable button.

### States

```
Default  → opacity 1.0
Hover    → opacity 0.9, slight elevation (transform: translateY(-1px))
Active   → transform: scale(0.97)
Disabled → opacity 0.4, cursor: not-allowed
Loading  → inline spinner, text hidden, fixed width
```

**Primary button states** (override the generic states above):

```
Default  → bg green-base #A5E07F · text ink (11.25:1)
Hover    → opacity 0.9 + translateY(-1px) · ink on the blended fill ≥ 11.6:1
Pressed  → scale(0.97) + inset border 1.5px green-dark #2F7A1F (3.46:1 against the fill) · ink text 11.25:1
Focus    → 2px green-dark outline, 2px offset (5.35:1 on Surface)
Disabled → bg shell #F8F7F4 · border 1.5px dashed ink-3 #6E6E6E · text ink-3 (4.76:1) · aria-disabled="true"
           Distinguished by fill, dashed outline and grey text, never by color alone. Pair with a caption saying how to enable it when it isn't obvious.
Loading  → inline spinner in ink, text hidden, fixed width
```
The green-base fill has only 1.55:1 against Surface: the button is identified by its Ink label and pill shape, which WCAG accepts; never rely on the fill alone to signal the button.

**Destructive vs Primary**: the Destructive button (error-dark fill, white text, leading icon) is dark and saturated; the Primary is a light fill with dark text, so the two never look alike, even in grayscale.

### Text links
Body 14px/500 in green-dark, minimum 44px tap height. Quiet links (e.g. "Log out" under a screen, "Close my account" at the bottom of settings): Body 14px/400 Ink 2, underlined.

### Camera shutter
64×64px, `radius-full`, Primary colors (green-base bg, ink `camera` icon 28px, 11.25:1), pressed state as Primary, `aria-label="Take the photo"`.

---

## 6. Components — Badges & Tags

### Badges (semantic, status)

```
badge-green    → bg: #E6F7DD · text: #2F7A1F · "Confirmed ✓", "Covered ✓", "Available", "Verified ✓"
badge-lavender → bg: #EDE9FD · text: #6B5BC4 · "Recommended", "New", counts ("3")
badge-sky      → bg: #E3F3FD · text: #1F6FA8 · "Community", "Today"
badge-pink     → bg: #FFEEF5 · text: #B03A78 · Market-specific labels (no longer "Verified")
badge-yellow   → bg: #FFF6CC · text: #8F5E00 · "Reminder", "Your turn soon", "Needs a volunteer", "Pending", "Expires soon", "Not accepted", "Expired"
badge-neutral  → bg: #F8F7F4 · border: 0.5px rgba(0,0,0,0.08) · text: #4A4A4A · "Not verified", neutral statuses
```
There is no error badge: a status that asks the user to do something (e.g. a verification not accepted) is a soft alert (yellow), not an error.

**Specs**: `padding: 4px 10px · border-radius: 20px · font: 11px/500`

**Verification badge rule**: every person shown near a call to action carries either `badge-green` "Verified ✓" or `badge-neutral` "Not verified" (never blank, never the private reason). Both are tappable and open an explanation sheet. In dense lists, a 16px `shield-check` icon may replace the text badge (green-dark when verified, Ink 2 when not), with an `aria-label`.

### Tags (categories, filters, tips)

```
bg: #F8F7F4 · border: 0.5px rgba(0,0,0,0.08) · text: #4A4A4A
padding: 6px 10px · border-radius: 8px · font: 12px/400
```

---

## 7. Components — Cards

### Event Card (search & recommendation)

```
[4px green-base accent bar] | [title + badge-lavender "Recommended"]
                              [date · time · duration]
                              [place · distance]
                              [why recommended · avatars · "N families" badge]
```

- Accent bar = green base for all events (a sub-type color may be added after user testing)
- Always show the number of families as metadata
- On recommended events, add a short caption explaining why (e.g. "Families near you are going"). Recommendations are never mysterious
- The host's verification badge is visible on the card (section 6)
- Avatars rotate across the five Light/Dark pairs

### Community Card

```
[4px sky-base accent bar] | [community name + badge]
                            [number of families · neighborhood]
                            [family avatars]
                            [active services: chips (e.g. "Shared routine")]
```

- Services appear as tags, so new services can be added without redesigning the card
- Never show more than 3 service tags; the rest collapse into a "+2" tag

### Shared Routine Card

```
[day title] [badge]
────────────────────────
[icon] [Activity name]           [TIME]
       [place]
       [avatar] [Parent on duty]  [badge]
────────────────────────
[icon] [Activity name]           [TIME]
       [place]
       [avatar] [Parent on duty]  [badge]
```

- Time right-aligned: `16px/500`, or `32px/500` for the next upcoming activity
- The parent on duty is always visible. When it's the current user, the line reads **"You"** in sky-dark and the row gets a sky-light background
- Badges: green "Covered ✓"; yellow "Needs a volunteer" or "Your turn soon"
- Icon: 32×32px rounded square (`radius-sm`), sky-light background, **line icon in sky-dark** (stroke 1.8). No emoji.
- Separators `0.5px solid rgba(0,0,0,0.08)`
- A tap on a turn opens a bottom sheet to swap or offer the turn to another family

### Marketplace Card

```
[Provider photo/avatar]
[Name · Stars · badge-green "Verified ✓"]
[Service type · Rate]
[Availability]
[CTA]
```

### House Exchange Card

```
[Home photo]
[Family name · badge-green "Verified ✓"]
[Destination · Dates available]
[Home details: bedrooms · kid-friendly features]
[Status badge]
[CTA: "Propose an exchange"]
```

- A verification badge is **mandatory** on every home and family; this is the strongest trust signal in the app
- Dates and destination use `16px/500`
- Status: yellow "Pending", green "Exchange confirmed ✓", lavender "New"

### Icon squares

32×32px, `radius-sm`, line icon 18px stroke 1.8.
- **Module**: module Light background + module Dark icon (as in the Shared Routine Card).
- **Neutral** (cross-module screens, settings rows): Shell `#F8F7F4` background + Ink 2 icon.
- **Verification**: green-light background + green-dark `shield-check` icon.

### Settings list
Surface card, `padding: 0 16px`, rows ≥ 52px: [icon square] [Body Ink label] [chevron-right Ink 3], separators 0.5px Border.

---

## 8. Components — Inputs and form controls

### Text input

```
border: 1.5px solid #6E6E6E (Ink 3)        ← was rgba(0,0,0,0.08), failed 3:1 for controls
border-radius: 12px (radius-md)
padding: 10px 14px · min-height: 44px
font: 14px/400
background: #FFFFFF

:focus       → border-color: #2F7A1F (green-dark)
:placeholder → color: #6E6E6E
error        → border-color: #B42318 (error-dark)
```

### Field anatomy

```
[Label]        Body 14px/400 · Ink 2 · always visible, above the field · gap 4px
[Input]
[Helper text]  Caption 12px/400 · Ink 3 · optional (e.g. "At least 10 characters")
[Error text]   Caption 12px/400 · error-dark · leading alert-circle icon 14px · replaces the helper
```
Errors say what to do ("Use at least 10 characters"), are linked with `aria-describedby`, announced with `aria-live="polite"`, and focus moves to the first field in error. Password fields have an eye toggle (`aria-label="Show password"`).

### Checkbox

```
box: 24×24px · border: 1.5px solid #6E6E6E · radius-sm (8px) · bg: #FFFFFF
checked: bg green-dark · white check icon (stroke 1.8)
error: border error-dark + error text under the row
row: full width tappable, min-height 44px, gap 12px, label Body 14px Ink
```
Unticked by default for any consent.

### Radio list

```
radio: 22×22px · border: 1.5px solid #6E6E6E · radius-full
selected: border green-dark + 10px green-dark inner dot
row: Surface, min-height 52px, label Body Ink + optional Caption Ink 3 below, separators 0.5px Border
```

---

## 9. Components — Notifications, banners and toasts

### Notifications
Five semantic levels. **Tinted card** (`radius-lg`, padding 12px 16px) with a colored dot. No colored left border.

```
Recommendation → bg: lavender-light · dot: lavender-dark · caption: lavender-dark
Community      → bg: sky-light      · dot: sky-dark      · caption: sky-dark
Reminder       → bg: yellow-light   · dot: yellow-dark   · caption: yellow-dark
Confirmed      → bg: green-light    · dot: green-dark    · caption: green-dark
Error          → bg: error-light    · alert-circle icon in error-dark (replaces the dot) · caption: error-dark
```

Examples:
- Recommendation: "A new picnic near you this Saturday"
- Community: "Sarah offered you her Thursday pick-up turn"
- Reminder: "Your pick-up turn is tomorrow at 16:30"
- Confirmed: "Exchange with the Martin family confirmed"
- Error: "We couldn't reach SPARKCIRCLES" / "Check your connection and try again."

Structure: `[dot or icon] [title 13px/500 ink] + [caption 12px/400 in the accent's dark]`. The Error card may carry a Small Secondary button ("Try again").

### Toast
Short confirmation after an action. Surface, `radius-lg`, padding 12px 16px, Level 3 shadow, Body 14px Ink with a leading 20px line icon (green-dark `check` for success, error-dark `alert-circle` for failure). Bottom of the screen, above the tab bar, 3 s, `role="status"`.

---

## 10. Navigation — Tab Bar, header, sheets

### Tab bar
5 main tabs (fixed order), each with its own color:

| Tab | Icon | Section | Color |
|---|---|---|---|
| **Home** | `home` | Today's dashboard | Lavender |
| **Events** | `sparkles` | Event search, creation & recommendations | Fresh green |
| **Community** | `users` | Family groups and shared services | Sky |
| **Market** | `shopping-bag` | Verified marketplace | Cotton pink |
| **Travel** | `key` | Vacation house exchange | Sunny yellow |

**Container**: white, border-radius 16px, padding 6px, `0.5px` border, level-1 shadow.
**Active tab**: `bg: module Base · text and icon: Ink · radius: 12px`
**Inactive tab**: icon and label in the module's **Dark** variant
**Labels**: always visible under the icon (never icon-only), 11px/500. Icons 20px, stroke 1.8.
**Touch target**: ≥ 44px high.

### Header (pushed screens)
44×44px icon-only back button (`chevron-left` 20px, Ink, `aria-label="Back"`), aligned with the screen padding, then the page title in H1 below it. Optional step counter right-aligned on the same row (Caption Ink 3, "Step 2 of 4").

### "My account" entry
LG avatar button (44px, initials, rotating Light/Dark pair) at the top right of the Today greeting. It opens "My account". Profile photos replace initials when available.

### Bottom sheets
Surface, `radius-xl` top corners, Level 2 shadow, padding 24px 16px 48px, Scrim behind. Close with a 44px `x` button (`aria-label="Close"`), swipe down, or the sheet's action.

---

## 11. Avatars

```
Size SM → 24×24px · font: 10px · border-radius: 50%
Size MD → 36×36px · font: 13px · border-radius: 50%
Size LG → 44×44px · font: 15px · border-radius: 50%

Colors (rotating per family): bg Light · text Dark of the same accent
1 → #EDE9FD / #6B5BC4   2 → #E6F7DD / #2F7A1F   3 → #FFEEF5 / #B03A78
4 → #E3F3FD / #1F6FA8   5 → #FFF6CC / #8F5E00
```
Former members (closed accounts): neutral avatar (Shell bg, Ink 2 "?"), name "Former member", no badge.

---

## 12. Empty states

Each module has its own themed empty state. Illustration is an emoji at 32px (the one place emoji stay), CTA is a **Module CTA** button (module Base, ink text).

| Module | Illustration | Title | Sub | CTA | Background |
|---|---|---|---|---|---|
| Events | 🦄 | No events nearby yet | Create the first one, or complete your profile to get recommendations from families in your neighborhood! | Create an event | green-light |
| Community | 🏡 | No community yet | Create a small group with nearby families, or join one, to share the daily routine. | Create my community | sky-light |
| Shared routine | 📅 | No shared routine yet | Add a recurring activity, like school pick-up, and let families take turns. | + First activity | sky-light |
| Marketplace | 🔍 | No results for this search | Try another neighborhood or another type of childcare. | Edit search | pink-light |
| House exchange | 🧳 | No exchange yet | Add your home and your holiday dates to start finding families to swap with. | Add my home | yellow-light |

**Rule**: Empty states are always an **invitation to act**, never a dead end.

---

## 13. Loading states

### Skeleton screen
- Use `rgba(0,0,0,0.08)` for skeleton blocks
- Animation: `shimmer` — opacity pulsing from 0.5 to 1.0, duration 1.5s, `ease-in-out`
- Reproduce the exact structure of the card being loaded
- Never a lone spinner on a whole page — always a skeleton

### "Magic" micro-interactions

| Trigger | Animation | Duration |
|---|---|---|
| New recommendation found | Card slides in from the bottom + badge pulses 2× | 400ms + 600ms |
| Turn taken or swapped | Checkmark draws itself + background turns green-light | 300ms |
| Event joined | Confetti emoji burst (3 emojis) + card bounce | 500ms |
| House exchange confirmed | Confetti emoji burst (🧳 🏡 ☀️) + card bounce | 500ms |
| Joined or created a community | Family avatars gently pop in one by one | 400ms |
| Email confirmed, verification sent, identity verified | Green-dark checkmark draws itself in a green-light circle (no confetti: these are serious moments) | 300ms |
| Loading recommendations | 🦄 icon gently spinning | 1.2s loop |

**Rule**: Animations exist only to **confirm a successful action** or **reduce waiting anxiety**. Never decorative when idle.

---

## 14. Elevation & shadows

```
Level 0 → no shadow · border: 0.5px solid rgba(0,0,0,0.08)   (standard cards)
Level 1 → box-shadow: 0 1px 4px rgba(0,0,0,0.04)             (resting cards, tab bar)
Level 2 → box-shadow: 0 4px 16px rgba(0,0,0,0.08)            (modals, bottom sheets)
Level 3 → box-shadow: 0 8px 32px rgba(0,0,0,0.12)            (toasts, floating notifications)
```

---

## 15. Tailwind / NativeWind tokens

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Accents (module in comment)
        'lavender': { light: '#EDE9FD', DEFAULT: '#C5B8F5', dark: '#6B5BC4' }, // Home + recommendations (was 'violet')
        'green':    { light: '#E6F7DD', DEFAULT: '#A5E07F', dark: '#2F7A1F' }, // Events + success + verified · Primary button = bg-green text-ink · green text/borders/focus = green-dark
        'sky':      { light: '#E3F3FD', DEFAULT: '#8FD3F7', dark: '#1F6FA8' }, // Community
        'pink':     { light: '#FFEEF5', DEFAULT: '#FFB6D3', dark: '#B03A78' }, // Market
        'sunny':    { light: '#FFF6CC', DEFAULT: '#FFD93D', dark: '#8F5E00' }, // Travel + soft alerts
        // Status (not a module)
        'error':    { light: '#FDECEC', DEFAULT: '#F4A6A6', dark: '#B42318' }, // errors + destructive actions
        // Neutrals
        'shell': '#F8F7F4',
        'surface': '#FFFFFF',
        'ink': { DEFAULT: '#1A1A1A', 2: '#4A4A4A', 3: '#6E6E6E' },
        'border-soft': 'rgba(0,0,0,0.08)',
        'border-control': '#6E6E6E',
        'scrim': 'rgba(26,26,26,0.4)',
      },
      borderRadius: {
        'sm': '8px', 'md': '12px', 'lg': '16px', 'xl': '24px', 'pill': '100px',
      },
      fontSize: {
        'data': ['32px', { lineHeight: '1.0', fontWeight: '500' }],
        'h1': ['28px', { lineHeight: '1.2', fontWeight: '500' }],
        'h2': ['20px', { lineHeight: '1.3', fontWeight: '500' }],
        'h3': ['16px', { lineHeight: '1.4', fontWeight: '500' }],
        'body': ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'label': ['11px', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.06em' }],
      },
      spacing: {
        'xs': '4px', 'sm': '8px', 'md': '12px', 'lg': '16px',
        'xl': '24px', '2xl': '32px', '3xl': '48px',
      },
      boxShadow: {
        'card': '0 1px 4px rgba(0,0,0,0.04)',
        'modal': '0 4px 16px rgba(0,0,0,0.08)',
        'float': '0 8px 32px rgba(0,0,0,0.12)',
      },
    },
  },
};
```

> Note: `green`, `sky` and `pink` override Tailwind's default palettes of the same name. This is intentional so that only the SPARKCIRCLES colors exist in the product. `violet` is no longer defined (renamed `lavender` in v1.3): replace any `violet-*` class with `lavender-*` for Home and recommendations, or `green-*` for Events. Primary button: `bg-green text-ink`; pressed `border-green-dark`; disabled `bg-shell border-dashed border-ink-3 text-ink-3`. Green text, icons, borders and focus always use `green-dark`, never `green` (Base).

---

## 16. UX principles — Reducing mental load

### P1 — Priority information first
Time, place and **who is on duty** are **always** the largest and highest-contrast elements of a routine card.

### P2 — One visible call to action at a time
Each screen has one primary action (green). Secondary actions are ghost buttons or in a contextual menu.

### P3 — Immediate feedback on every action
Every action triggers a visual response in < 100ms. Important confirmations get a micro-animation.

### P4 — The "child world" in touches, not in bulk
Color, rounded shapes and small illustrations are present but never overwhelm the UI. Adults use the app — not children. The charm should reassure without infantilizing.

### P5 — Errors are invitations, not condemnations
Empty states always have a CTA. Error messages say what to do, not just what went wrong. The Error color is reserved for real errors and destructive actions, always with an icon and text.

### P6 — Non-negotiable accessibility
- Contrast ratios: ≥ 4.5:1 for all informational text, ≥ 3:1 for control boundaries (see section 1 rules)
- Touch targets: ≥ 44×44px for all interactive elements
- Always a visible label (never the placeholder alone)
- `aria-label` on icon-only controls
- Never color alone to convey a status or an error
- Respect `prefers-reduced-motion` for all animations

### P7 — Shared load must feel fair and visible
In communities, the distribution of turns is always transparent. Swapping or offering a turn takes two taps at most.

### P8 — Trust before convenience
Anything involving strangers, homes or children (events, marketplace, house exchange, communities) shows verification status upfront, before the call to action.

---

## 17. Screen architecture

Recommended design order based on survey pain points:

```
0. Accounts & verification → Designed (v1.3): sign-up, login, my account, identity verification
1. "Today" dashboard       → DONE (mockup validated on the v1.2 palette; refresh for v1.3: Home lavender, green CTA, account avatar)
2. Events Explorer         → Search, filters and recommended events
3. Event Detail            → Event detail page + RSVP (and event creation flow)
4. Community Hub           → Community list, members, available services
5. Shared Routine Builder  → Create/edit recurring tasks, turn-taking by availability
6. House Exchange          → Browse homes, add my home, propose and confirm an exchange
7. Marketplace             → Search and book childcare
8. Family Profile          → Setup and preferences
9. Onboarding              → 3 screens max, progressive
—  Admin back office       → Separate web app (desktop), minimal: verification queue and review
```

---

## 18. Open decisions

- **Green carries Events, the primary CTA and success** (including "Verified ✓"). Status meaning wins on badges and notifications, like the yellow rule below. Watch in user testing that green CTAs on non-event screens don't feel "event-related", and that "Confirmed ✓" isn't confused with Events identity.
- **Lavender = Home and recommendations** — *confirmed by the PM (2026-10-02)*. Recommendations shown on Today and on event cards keep lavender ("Recommended" badge, Recommendation notification) even though events are green, so they never look like a Confirmed notification. Still observe in user testing.
- **Yellow doubles as Travel and soft alerts.** Status meaning wins on badges and notifications; the Travel tab and house-exchange cards use yellow as identity.
- **Error vs Market pink**: both are warm reds/pinks. Error is always paired with an icon and only appears on errors and destructive actions; check that they stay distinct in testing.
- **Community services**: Only the shared routine builder is defined. Review the "+N" tag pattern whenever a new service is added.
- **House exchange scope**: open to all verified families, or limited to a community? Affects verification flow and card layout.
- **Exchange model**: direct swap only, or also lending or renting? Affects status badges and CTA wording.
- **Tab bar**: five tabs is the practical maximum on mobile. If more modules are added, group some under "More" or inside Community.
- **Module accents** are a proposal to validate in user testing.
- **Language switch** (FR/EN at launch): Caption-size text link on the Welcome screen ("Français" / "English"); later also in "My account".
- **Web admin back office**: uses the same tokens, but desktop rules are not defined yet: layout grid and max width, side navigation, data table, keyboard focus ring, image zoom viewer, breakpoints. To define when the back office grows beyond the verification queue.

---

*Document updated on October 2, 2026 — SPARKCIRCLES v1.3*
*To be updated after each user testing cycle.*
