# SPARKCIRCLES — Design System v1.2
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
| **Fresh green** | `#E6F7DD` | `#A5E07F` | `#2F7A1F` | Home |
| **Violet** | `#EDE9FD` | `#C5B8F5` | `#6B5BC4` | Events |
| **Sky** | `#E3F3FD` | `#8FD3F7` | `#1F6FA8` | Community (incl. shared routine) |
| **Cotton pink** | `#FFEEF5` | `#FFB6D3` | `#B03A78` | Market |
| **Sunny yellow** | `#FFF6CC` | `#FFD93D` | `#8F5E00` | Travel |

### Neutral base

| Name | Hex | Usage |
|---|---|---|
| **Shell background** | `#F8F7F4` | App background — slightly warm off-white |
| **Surface** | `#FFFFFF` | Cards, modals, drawers |
| **Border** | `rgba(0,0,0,0.08)` | Separators, card outlines |
| **Ink** | `#1A1A1A` | Primary text — times, names, critical data |
| **Ink 2** | `#4A4A4A` | Secondary text — labels, descriptions |
| **Ink 3** | `#6E6E6E` | Tertiary text — metadata, captions *(was `#8A8A8A`, failed AA)* |

### Contrast rules (WCAG AA, informational text ≥ 4.5:1)

1. **Text on an accent's Light background** → always the **Dark** variant of the same accent.
2. **Filled element in a Base color** (active tab, chip, avatar fill) → **Ink** text.
3. **White text** → only on a **Dark** variant (e.g. primary button).
4. Never pure black `#000000` on a colored background.

Measured ratios (approximate):

| Accent | White on Dark | Dark on Light | Ink on Base |
|---|---|---|---|
| Fresh green | 5.3 | 4.8 | > 10 |
| Violet | 5.4 | 4.5 | > 9 |
| Sky | 5.4 | 4.8 | > 10 |
| Cotton pink | 5.6 | 5.0 | > 10 |
| Sunny yellow | 5.6 | 5.1 | > 12 |

### Color semantics in the UI
Module colors identify **where you are**. Status colors always take priority on badges and notifications.

```
Violet  → Events, recommendations, primary action (CTA)
Sky     → Community, shared routine, "you" on a turn
Green   → Home + success: "Confirmed ✓", "Covered ✓", "Available"
Pink    → Marketplace, verified providers
Yellow  → Travel + soft alerts: reminders, "Needs a volunteer", "Your turn soon"
```

### Module accents
Used for **illustrations, empty-state backgrounds, card accent bars and the tab bar**.

| Module | Accent | Where it appears |
|---|---|---|
| **Home** | Fresh green | Dashboard greeting accents, Home tab |
| **Events** | Violet | Event cards, empty state, Events tab |
| **Community** (incl. shared routine) | Sky | Community cards, routine card accent, empty states |
| **Marketplace** | Cotton pink | Provider cards, search empty state |
| **House exchange / Travel** | Sunny yellow | Home cards, exchange empty state |

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
| **Body** | 14px | 400 | 1.6 | Regular content, descriptions |
| **Caption** | 12px | 400 | 1.5 | Metadata, timestamps, secondary info |
| **Label** | 11px | 500 | 1.4 | Uppercase section headers + letter-spacing 0.06em (use Ink 2) |
| **Data display** | 32px | 500 | 1.0 | Times, key numbers (08:30, 3 families) |

### Typographic golden rule
> The time and place of every activity, and **who is on duty**, must be readable **in under one second**, even by an exhausted parent at 7 a.m.

Always use `Data display (32px / 500)` for the next upcoming time, and never go below 16px for activity names or the name of the parent on duty.

---

## 3. Spacing

System based on a **4px** grid.

| Token | Value | Usage |
|---|---|---|
| `space-xs` | 4px | Minimal internal gap (icon + text) |
| `space-sm` | 8px | Gap between elements on the same row |
| `space-md` | 12px | Gap between rows within a card |
| `space-lg` | 16px | Internal card padding |
| `space-xl` | 24px | Gap between sections |
| `space-2xl` | 32px | Margin between major blocks |
| `space-3xl` | 48px | Bottom page padding (tab bar clearance) |

---

## 4. Border radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 8px | Tags, small inner badges, icon squares |
| `radius-md` | 12px | Inputs, selects, small chips, tab buttons |
| `radius-lg` | 16px | Cards, panels, list items, notifications |
| `radius-xl` | 24px | Modals, bottom sheets, large hero cards |
| `radius-pill` | 100px | All buttons, main badges |
| `radius-full` | 50% | Avatars, round icons |

---

## 5. Components — Buttons

### Variants

```
Primary    → bg: violet-dark (#6B5BC4) · text: white · radius: pill
Secondary  → bg: violet-light (#EDE9FD) · text: violet-dark · radius: pill
Ghost      → bg: transparent · border: 1.5px violet-dark · text: violet-dark · radius: pill
Module CTA → bg: module base · text: ink · radius: pill (e.g. empty states)
```
The former peach "Danger CTA" is removed. There is no alarm-colored button in the system.

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

---

## 6. Components — Badges & Tags

### Badges (semantic, status)

```
badge-green  → bg: #E6F7DD · text: #2F7A1F · "Confirmed ✓", "Covered ✓", "Available"
badge-violet → bg: #EDE9FD · text: #6B5BC4 · "Recommended", "3 families", "New"
badge-sky    → bg: #E3F3FD · text: #1F6FA8 · "Community", "Today"
badge-pink   → bg: #FFEEF5 · text: #B03A78 · "Verified ✓" (marketplace)
badge-yellow → bg: #FFF6CC · text: #8F5E00 · "Reminder", "Your turn soon", "Needs a volunteer", "Pending"
```

**Specs**: `padding: 4px 10px · border-radius: 20px · font: 11px/500`

### Tags (categories, filters)

```
bg: #F8F7F4 · border: 0.5px rgba(0,0,0,0.08) · text: #4A4A4A
padding: 6px 10px · border-radius: 8px · font: 12px/400
```

---

## 7. Components — Cards

### Event Card (search & recommendation)

```
[4px violet-base accent bar] | [title + badge-violet "Recommended"]
                               [date · time · duration]
                               [place · distance]
                               [why recommended · avatars · "N families" badge]
```

- Accent bar = violet base for all events (a sub-type color may be added after user testing)
- Always show the number of families as metadata
- On recommended events, add a short caption explaining why (e.g. "Families near you are going"). Recommendations are never mysterious
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
[Name · Stars · badge-pink "Verified ✓"]
[Service type · Rate]
[Availability]
[CTA]
```

### House Exchange Card

```
[Home photo]
[Family name · badge-pink "Verified ✓"]
[Destination · Dates available]
[Home details: bedrooms · kid-friendly features]
[Status badge]
[CTA: "Propose an exchange"]
```

- A verification badge is **mandatory** on every home and family; this is the strongest trust signal in the app
- Dates and destination use `16px/500`
- Status: yellow "Pending", green "Exchange confirmed ✓", violet "New"

---

## 8. Components — Inputs

```
border: 1.5px solid rgba(0,0,0,0.08)
border-radius: 12px (radius-md)
padding: 10px 14px
font: 14px/400
background: #FFFFFF

:focus → border-color: #6B5BC4 (violet-dark)
:placeholder → color: #6E6E6E
```

Always paired with a visible `label` (never the placeholder alone).

---

## 9. Components — Notifications

Four semantic levels. **Tinted card** (`radius-lg`, padding 12px 16px) with a colored dot. No colored left border.

```
Recommendation → bg: violet-light · dot: violet-dark · caption: violet-dark
Community      → bg: sky-light    · dot: sky-dark    · caption: sky-dark
Reminder       → bg: yellow-light · dot: yellow-dark · caption: yellow-dark
Confirmed      → bg: green-light  · dot: green-dark  · caption: green-dark
```

Examples:
- Recommendation: "A new picnic near you this Saturday"
- Community: "Sarah offered you her Thursday pick-up turn"
- Reminder: "Your pick-up turn is tomorrow at 16:30"
- Confirmed: "Exchange with the Martin family confirmed"

Structure: `[dot] [title 13px/500 ink] + [caption 12px/400 in the accent's dark]`

---

## 10. Navigation — Tab Bar

5 main tabs (fixed order), each with its own color:

| Tab | Icon | Section | Color |
|---|---|---|---|
| **Home** | `home` | Today's dashboard | Fresh green |
| **Events** | `sparkles` | Event search, creation & recommendations | Violet |
| **Community** | `users` | Family groups and shared services | Sky |
| **Market** | `shopping-bag` | Verified marketplace | Cotton pink |
| **Travel** | `key` | Vacation house exchange | Sunny yellow |

**Container**: white, border-radius 16px, padding 6px, `0.5px` border, level-1 shadow.
**Active tab**: `bg: module Base · text and icon: Ink · radius: 12px`
**Inactive tab**: icon and label in the module's **Dark** variant
**Labels**: always visible under the icon (never icon-only), 11px/500. Icons 20px, stroke 1.8.
**Touch target**: ≥ 44px high.

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

---

## 12. Empty states

Each module has its own themed empty state. Illustration is an emoji at 32px (the one place emoji stay), CTA is a **Module CTA** button (module Base, ink text).

| Module | Illustration | Title | Sub | CTA | Background |
|---|---|---|---|---|---|
| Events | 🦄 | No events nearby yet | Create the first one, or complete your profile to get recommendations from families in your neighborhood! | Create an event | violet-light |
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
        'green':  { light: '#E6F7DD', DEFAULT: '#A5E07F', dark: '#2F7A1F' }, // Home
        'violet': { light: '#EDE9FD', DEFAULT: '#C5B8F5', dark: '#6B5BC4' }, // Events
        'sky':    { light: '#E3F3FD', DEFAULT: '#8FD3F7', dark: '#1F6FA8' }, // Community
        'pink':   { light: '#FFEEF5', DEFAULT: '#FFB6D3', dark: '#B03A78' }, // Market
        'sunny':  { light: '#FFF6CC', DEFAULT: '#FFD93D', dark: '#8F5E00' }, // Travel + alerts
        // Neutrals
        'shell': '#F8F7F4',
        'surface': '#FFFFFF',
        'ink': { DEFAULT: '#1A1A1A', 2: '#4A4A4A', 3: '#6E6E6E' },
        'border-soft': 'rgba(0,0,0,0.08)',
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

> Note: `green`, `violet`, `sky` and `pink` override Tailwind's default palettes of the same name. This is intentional so that only the five SPARKCIRCLES accents exist in the product.

---

## 16. UX principles — Reducing mental load

### P1 — Priority information first
Time, place and **who is on duty** are **always** the largest and highest-contrast elements of a routine card.

### P2 — One visible call to action at a time
Each screen has one primary action (violet). Secondary actions are ghost buttons or in a contextual menu.

### P3 — Immediate feedback on every action
Every action triggers a visual response in < 100ms. Important confirmations get a micro-animation.

### P4 — The "child world" in touches, not in bulk
Color, rounded shapes and small illustrations are present but never overwhelm the UI. Adults use the app — not children. The charm should reassure without infantilizing.

### P5 — Errors are invitations, not condemnations
Empty states always have a CTA. Error messages say what to do, not just what went wrong.

### P6 — Non-negotiable accessibility
- Contrast ratios: ≥ 4.5:1 for all informational text (see section 1 rules)
- Touch targets: ≥ 44×44px for all interactive elements
- Always a visible label (never the placeholder alone)
- `aria-label` on icon-only controls
- Respect `prefers-reduced-motion` for all animations

### P7 — Shared load must feel fair and visible
In communities, the distribution of turns is always transparent. Swapping or offering a turn takes two taps at most.

### P8 — Trust before convenience
Anything involving strangers, homes or children (marketplace, house exchange, communities) shows verification status upfront, before the call to action.

---

## 17. Screen architecture

Recommended design order based on survey pain points:

```
1. "Today" dashboard       → DONE (mockup validated, v1.2 palette)
2. Events Explorer         → Search, filters and recommended events
3. Event Detail            → Event detail page + RSVP (and event creation flow)
4. Community Hub           → Community list, members, available services
5. Shared Routine Builder  → Create/edit recurring tasks, turn-taking by availability
6. House Exchange          → Browse homes, add my home, propose and confirm an exchange
7. Marketplace             → Search and book childcare
8. Family Profile          → Setup and preferences
9. Onboarding              → 3 screens max, progressive
```

---

## 18. Open decisions

- **Primary CTA vs Events color**: the primary button is violet, which is also the Events color. Confirm in user testing that CTAs on non-event screens don't feel "event-related".
- **Green doubles as Home and success** ("Covered ✓", "Confirmed ✓"). Watch for confusion in testing.
- **Yellow doubles as Travel and soft alerts.** Status meaning wins on badges and notifications; the Travel tab and house-exchange cards use yellow as identity.
- **Community services**: Only the shared routine builder is defined. Review the "+N" tag pattern whenever a new service is added.
- **House exchange scope**: open to all verified families, or limited to a community? Affects verification flow and card layout.
- **Exchange model**: direct swap only, or also lending or renting? Affects status badges and CTA wording.
- **Tab bar**: five tabs is the practical maximum on mobile. If more modules are added, group some under "More" or inside Community.
- **Module accents** are a proposal to validate in user testing.

---

*Document updated on October 2, 2026 — SPARKCIRCLES v1.2*
*To be updated after each user testing cycle.*
