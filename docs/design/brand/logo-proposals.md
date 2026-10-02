# SparkCircles — Logo and app icon proposals

> **Chosen direction: Ripple** (approved by the PM on 2026-10-02), a combination of the three directions below: open pastel rings around a lemon spark, with the "SparkCircles" wordmark built from direction 3's lowercase alphabet. Files and preview: [`ripple/`](ripple/) (`ripple/preview.html`). Usage rules: design system v1.4, section 19 "Brand". The three original directions below are kept as history.

> Author: designer · Date: 2026-10-02 · **Status: Proposal, waiting for PM review**
>
> Brief: the product context in `CLAUDE.md` and design system v1.3 (the "Sober Unicorn": sober, warm, reassuring, with joyful touches; trustworthy; never childish, never corporate-cold).
>
> Open `docs/design/brand/logo-proposals.html` in a browser to compare the three directions side by side.

## Files

```
docs/design/brand/
├── logo-proposals.html            presentation page (self-contained)
├── logo-proposals.md              this file
├── circle-of-five/                direction 1
├── spark-ring/                    direction 2 (recommended)
├── sober-unicorn/                 direction 3
└── _source/                       scripts that write the SVGs and the page from the hand-built geometry
```

Each direction folder has the same 14 SVGs:

| File | Use |
|---|---|
| `symbol.svg` / `symbol-reverse.svg` / `symbol-mono.svg` | Mark on light, on dark, in one colour (Ink) |
| `wordmark.svg` / `wordmark-reverse.svg` | Wordmark on light / dark |
| `lockup-horizontal(-reverse).svg` | Symbol + wordmark side by side |
| `lockup-stacked(-reverse).svg` | Symbol above wordmark |
| `icon-1024.svg` | **iOS master**, 1024×1024, square, opaque, no corner mask (the system applies it) |
| `icon-tinted-1024.svg` | iOS tinted-icon source: grayscale (white mark on Ink), the system applies the tint |
| `icon-foreground.svg` | **Android adaptive icon** foreground, 108×108 dp canvas, content inside the 66 dp safe circle |
| `icon-background.svg` | Android adaptive icon background layer: one plain colour |
| `icon-mono.svg` | Android themed icon (monochrome layer), 108×108 dp, single colour, same safe zone |

**How the files are built.** Every shape is hand-built geometry (circles, arcs, lines, a four-point spark from four cubic curves). The wordmarks are custom monoline letterforms drawn as stroked paths on a grid (no font, nothing copied from a commercial typeface), so they render the same everywhere. The scripts in `_source/` hold the coordinates and write clean SVGs (no IDs, no filters, no gradients). Edit the geometry there and re-run rather than editing the SVGs by hand. Before handing the SVGs to the developer, strokes can be outlined (stroke to path) in a vector editor if a tool needs filled shapes only.

**Exporting PNGs (developer).** iOS: export `icon-1024.svg` to a 1024×1024 PNG without alpha; Xcode generates the other sizes. Android: use `icon-foreground.svg`, `icon-background.svg` and `icon-mono.svg` as the adaptive icon's `foreground`, `background` and `monochrome` layers (vector drawables or 432×432 px PNGs); Expo takes them through `android.adaptiveIcon` (`foregroundImage`, `backgroundColor`, `monochromeImage`).

## The three directions

### 1 · Circle of five
- **Symbol**: five round "family circles", one per module colour, set on a ring around a four-point spark.
- **Wordmark**: lowercase monoline "sparkcircles" (stroke 4.2 on a 20-unit x-height); the dot of the **i** is a small spark in lavender.
- **App icon**: Ink background, the five dots in the Base colours, the spark in white.
- **Rationale**: it tells the whole story in one shape: small circles of nearby families gathered around a moment of joy, and the five colours of the app's five tabs. The dark icon makes the pastels glow without any gradient, and the dots give the brand a ready-made secondary pattern (loaders, avatar rows, illustrations).
- **Strong**: most "SparkCircles" of the three; joyful but orderly; very recognisable on a dark home screen.
- **Weak**: busy at 29 px (the spark shrinks to a speck); on light backgrounds the Dark variants needed for contrast (brown yellow, plum) look muddier than the pastels; rainbow dots are a common community-app trope.

### 2 · Spark ring (recommended)
- **Symbol**: one circle drawn with a single line (stroke ratio equal to the 1.8 px line icons at 24 px), opened at the top right by a spark that escapes from it.
- **Wordmark**: the name drawn in all-capital monoline letters, generously tracked, built from simple geometric strokes. Calm and legible.
- **App icon**: green Base background (the primary button colour), Ink ring and spark.
- **Rationale**: the circle is the community and the safety it gives (closed, protective); the spark is the energy and joy that circle releases. It is the same drawing language as the app's line icons, so the brand and the product feel like one object. It's the most reassuring of the three, which matters for an app about verification and children's safety; the joy comes from the spark, the green, and the app itself.
- **Strong**: sharpest at 29–40 px; perfect in one colour, tinted and themed modes; easy to animate (the spark can draw the ring as a success micro-interaction); strongest grayscale contrast.
- **Weak**: the least playful; circle + star marks are frequent, so the exact opening angle and spark shape are what make it ownable; the spark is close to the Events tab `sparkles` icon (see implications).

### 3 · Sober unicorn
- **Symbol**: the design system's own metaphor made literal and geometric: a round head with one eye, a horn that is a spark of energy, and a two-colour mane drawn as two arcs.
- **Wordmark**: the same lowercase family as direction 1, heavier (stroke 4.8), with a plain round i-dot (the symbol carries the character).
- **App icon**: lavender Dark background, white head, yellow horn, pink and sky mane, Ink eye.
- **Rationale**: the most memorable and characterful option. It connects to the unicorn already used in empty states and gives children a friendly figure, while parents see a calm, geometric shape. It could become a mascot for onboarding, loaders and celebrations.
- **Strong**: instantly memorable; warm; a natural mascot.
- **Weak**: highest risk of looking childish next to identity verification and safety topics; unicorns are used by many brands (harder to protect and to keep distinct); in one colour the mane reads like "speed lines".

## Recommendation

**Direction 2, Spark ring**, for the app icon and the main logo:
1. It best serves the trust promise (verification, children's safety) without becoming corporate.
2. It is the most legible at home-screen sizes and in all system icon modes.
3. It matches the line-icon language of the app, and the green icon ties directly to the primary button.

To keep the joy, borrow the five coloured dots of direction 1 as a **secondary brand pattern** (loading state, onboarding illustrations, marketing), never as a second logo. Keep the unicorn of direction 3 as a possible illustration character, not as the logo.

## Contrast and colour check

- Only design system v1.3 tokens are used: Ink, Surface (white), Shell, and the Light / Base / Dark stops of lavender, green, sky, pink and yellow. **No new colour.**
- Wordmarks: Ink on Surface 17.4:1, Ink on Shell 16.25:1, white on Ink 17.4:1.
- Icons (shape against background): direction 1 Base dots and white spark on Ink (all > 9:1); direction 2 Ink on green Base 11.25:1; direction 3 white head on lavender Dark 5.36:1, yellow Base horn on lavender Dark 3.89:1, pink and sky Base mane on lavender Dark 3.29 and 3.27:1, Ink eye on white 17.4:1.
- Grayscale: checked on the page (`filter: grayscale(1)`). Direction 2 is the clearest (dark line on a light field); directions 1 and 3 keep their silhouettes thanks to light shapes on a dark field, but direction 1's five dots become five similar greys.
- Known weak pair: in direction 3's light logo, the yellow Base horn is only 1.38:1 on white. It stays readable because it touches the lavender Dark head, but it shouldn't be used alone on white.

## Design system implications (proposals, for the PM to decide)

The design system file was not edited. If a direction is adopted:
1. **Wordmark**: replace "Until a logo exists, the wordmark is SparkCircles in H1" (section 2) with the chosen SVG wordmark, a minimum size (proposal: 16 px tall for the horizontal lockup in the app, 24 px tall for the stacked one) and a clear space equal to the spark's height around the lockup.
2. **Brand name casing**: direction 2 draws the name in all capitals; directions 1 and 3 in lowercase. *(Since decided by the PM: the name is written "SparkCircles" everywhere, including under the icon.)*
3. **Spark vs Events icon**: the Events tab uses the `sparkles` line icon. With direction 1 or 2 the spark becomes the brand symbol, so a spark in the tab bar could read as "home of the brand" rather than "Events". Options: keep `sparkles` (two stars, visually different from the single brand spark), or switch Events to `calendar-heart` / `party-popper`. To decide with user testing.
4. **New brand section** in the design system: logo files, clear space, minimum sizes, do/don't (no recolouring outside tokens, no gradients, no outline effects, never on a busy photo without a Surface plate).
5. **Success micro-interaction** (direction 2 only, optional): "the spark draws the ring" could replace the green checkmark for account-level successes (email confirmed, verified). Not needed for v1.

## Notes for the PM

- **Trademark**: I can't run a trademark or similarity search. Before adopting the name and a mark, check "SparkCircles" and the chosen symbol with **INPI** (France) and **EUIPO** (EU), in classes 9 (software) and 42 (online services), and ideally 45 (social networking). A specialist IP adviser can also check figurative-mark similarity.
- **Originality**: the marks are built from basic geometry. Simple geometric marks are easy to make but harder to protect; the final choice should be checked for resemblance with registered marks before launch.
- **Refinement before final adoption**: these are proposal-level drawings. The chosen wordmark would benefit from a round of optical kerning and curve refinement (by me or a type designer), and the icon from a pixel-hinting check at 29 px on a real device.
- **App stores**: Apple requires the 1024 master to be opaque with no rounded corners (provided). Google Play also needs a 512×512 store icon, exportable from `icon-1024.svg`.
- **Dark mode icons (iOS 18+)**: iOS can also use a dark variant. Direction 2's dark variant would be the green spark and white ring on Ink (`symbol-reverse.svg` on an Ink square); I can add the file once a direction is chosen.
