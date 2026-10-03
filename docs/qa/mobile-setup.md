# QA report: Mobile setup

> Feature slug: `mobile-setup` · Author: qa · Date: 2026-10-03
>
> Branch `feat/mobile-setup`, local only (no PR). Code at `69356fb` (12 commits since `29fe96b`).
>
> There's no spec: this is infrastructure. References: the PM-approved [setup proposal](../mobile/setup-proposal.md) (M-1 to M-25, setup PR scope in section 9), the [design system](../SparkCircles_Design_System_EN.md) v1.4.1 (sections 2, 5, 9, 10, 13, 15, P6), [`mobile/README.md`](../../mobile/README.md), and the API contract [section 1](../api/accounts-and-verification.md) for the client's auth behaviour.
>
> PM decisions applied: the French label for Market is "Services" (English stays "Market"). Tailwind's default spacing, sizes and radii are allowed for now (only colours are restricted). The dev package `babel-preset-expo` is approved.
>
> While I tested, the PM's Metro (port 8081) and Rails API (port 3000) kept running. I didn't touch them: I sent only read-only `GET`s to `/up`, `/status` and `/api/v1/me`.

## Verdict: **PASS WITH ISSUES**

- All automated checks pass: tsc, ESLint + Prettier, Jest, `expo install --check`, and the iOS and Android bundles.
- The approved decisions are implemented as decided. Versions, folder layout and packages match the proposal.
- No blocker. **2 major issues**:
  - BUG-01: error notifications aren't announced by VoiceOver.
  - BUG-02: the French tab labels "Communauté" and "Événements" are probably cut off on iPhone-width screens. This needs a look on the PM's iPhone.
- Also 7 minor issues, 1 cosmetic issue and 4 design-system gaps.

## Automated checks

All run in `mobile/` with Node 22.23.3 (`nvm use`).

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass, 0 errors. Also passes without the generated `expo-env.d.ts` and `.expo/types`, as on a fresh CI checkout. I checked this with a temporary tsconfig in my scratchpad. |
| `npm run lint` (ESLint 9 + Prettier) | Pass, 0 problems. "All matched files use Prettier code style!" |
| `npx jest --ci` | Developer suite: **10 suites, 46 tests, all pass** (2.7 s). With my QA tests: **13 suites, 71 tests, all pass**. |
| `npx expo install --check` | "Dependencies are up to date" |
| `npx expo export --platform ios` | Pass. Hermes bundle 6.1 MB, 3600 modules, 23 assets. |
| `npx expo export --platform android` | Pass. Hermes bundle 6.3 MB. |
| `npm audit --omit=dev` | **60 vulnerabilities: 11 moderate, 49 high, 0 critical** (from `--json`; the text summary counts 63). Report only, not fixed. See "Dependency audit" below. |

I wrote the export output to my scratchpad and deleted it afterwards. `mobile/` has no `dist/` folder, and `git status` shows only my new test folder.

### Dependency audit (`npm audit --omit=dev`)

- **Root advisories:**
  - `braces`, `micromatch`: stack-exhaustion DoS
  - `node-forge`: RSA signature check
  - `uuid`: buffer bounds
  - `decode-uri-component`: DoS on malformed percent-encoding
- **Where they come from:** almost all reach the project through build and test tooling: Metro, `@expo/cli`, `@expo/config-plugins`, Jest, and Tailwind's `chokidar`/`fast-glob`. That code doesn't ship in the app bundle.
- **The one that runs inside the app:** `decode-uri-component`, through `expo-router` → `query-string`. It's moderate. It only matters when the app parses a hostile deep link.
- **Fixes:** every fix npm offers is a semver-major change or a downgrade (e.g. `expo@44`, `jest@30`, `tailwindcss@4`). None is compatible with SDK 57.
- **Recommendation:** wait for Expo SDK 57 patch releases (`npx expo install --fix`) and re-check with every SDK upgrade. No action in this PR.

## Proposal compliance

| Decision / scope item | Result | Evidence |
|---|---|---|
| M-1 Expo SDK 57, RN 0.86.3, React 19.2.3, TS ~6.0.3 | Pass | `npm ls --depth=0`: expo 57.0.26, react-native 0.86.3, react 19.2.3, typescript 6.0.3. `expo config` reports SDK 57.0.0. |
| M-2 Node 22, `.nvmrc` | Pass | `mobile/.nvmrc` = `22`. CI uses `node-version-file: mobile/.nvmrc`. |
| M-3 npm, lockfile committed, standalone project | Pass | `package-lock.json` is tracked. No workspaces. |
| M-4 / M-5 Expo Go on the iPhone, API reachable on the LAN | Pass (README needs fixes, BUG-03, BUG-04) | `.env.local` (git-ignored) points to `http://192.168.1.77:3000`, which is the current `en0` address. `GET /up` returns 200 in 10 ms. `GET /api/v1/me` without a token returns `401 {"error":{"code":"unauthorized",…}}`, which the client parses correctly. |
| M-7 Expo Router | Pass | `main: expo-router/entry`, routes in `src/app/`, `typedRoutes: true`, scheme `sparkcircles`. |
| M-8 Layout | Pass | Matches the proposal tree: `src/app` (routes only), `screens/`, `components/`, `api/`, `auth/`, `hooks/`, `i18n/`, `theme/`, `test/`. The Prettier config is `.prettierrc.json` instead of `.prettierrc`, which makes no difference. |
| Custom 5-tab bar (section 3, DS section 10) | Pass, with BUG-02 | `TabBar.tsx`: white container `rounded-lg` (16), `p-1.5` (6), `border-[0.5px] border-border-soft`, `boxShadow: shadows.card` (level 1). Active tab: `rounded-md` (12). Icons 20 px, labels always rendered, `minHeight: 44`. Fixed order Home, Events, Community, Market, Travel. Icons: `House` (Lucide's current name for `home`), `Sparkles`, `Users`, `ShoppingBag`, `Key`. |
| M-9 Gate off, tabs open directly | Pass | Root `Stack` holds only `(tabs)`. The session is built but not wired to screens. |
| M-10 NativeWind 4.2.7 + Tailwind 3.4.19 | Pass | Installed versions match. |
| M-11 Tokens under `theme.colors` (v1.4.1 section 15) | Pass | `tailwind.config.js` sets `theme.colors = tokens.colors`, with no `extend.colors`. `tokens.test.ts` evaluates the section 15 code block of the design-system doc and asserts the tokens are equal to it. CI also runs when the design-system file changes. Spacing, radii, font sizes and shadows stay under `extend`, as the PM decided. Unitless line heights (`1.2`…) are converted by react-native-css-interop into a font-size multiple (`parseLineHeight` → `em`), so the proposal's "native quirk" doesn't apply. |
| M-11 No-hex lint rule | Pass, with a gap (BUG-07) | Probed with `eslint --stdin` (no file written). **Caught:** `'#fff'`, `"#1A1A1A"`, `` `#abcdef` ``, `'rgba(0,0,0,0.1)'`, `'rgb(1, 2, 3)'`, `'hsl(…)'`, `className="bg-[#ff0000]"`, `className="text-[rgb(1,2,3)]"`, `{ borderColor: '#ABC' }`, and `'#123456'` in `tailwind.config.js`. **Not flagged (correctly):** `src/theme/tokens.js`. It even caught a test title of mine containing "rgb()". **Missed:** named colours `'red'`, `'black'`, `'tomato'` and the number `0xff0000`. |
| M-11 NativeWind root size 16 px | Pass | `metro.config.js`: `withNativeWind(config, { input: './global.css', inlineRem: 16 })` |
| Light mode only | Pass | `userInterfaceStyle: 'light'`, `StatusBar style="dark"` |
| M-12 System font, 400/500 only | Pass | No font package. My QA test scans `src/` for `font-semibold`/`bold`/`light`… and `fontWeight` 600–900: none found. |
| M-13 Icon wrapper, stroke 1.8, token colour | Pass | `Icon.tsx` uses `ICON_STROKE_WIDTH = 1.8` and `colorValue(token)`, and is hidden from accessibility. QA test: the rendered SVG has `strokeWidth` 1.8 and the token value. |
| M-14 Brand assets | Pass | `assets/brand/icon.png` 1024² RGB (opaque, Ripple on Ink). `icon-ios-tinted.png` 1024². `adaptive-icon-foreground.png` and `adaptive-icon-monochrome.png` 1024² RGBA. `splash-lockup.png` 1024×737 RGBA (stacked lockup, viewed). Resolved `expo config`: `icon`, `ios.icon.{light,dark,tinted}`, `android.adaptiveIcon.{foregroundImage, monochromeImage, backgroundColor #1A1A1A}`, splash plugin with `image`, `imageWidth 200`, `backgroundColor #F8F7F4` (Shell). Colours come from `tokens.js`. Export script present (`scripts/export-brand-assets.sh`). |
| M-15 API client | Pass | `client.ts`:<br>• Prefixes `/api/v1` and tolerates a trailing slash in the base URL (QA test).<br>• Sends `Accept` + `Accept-Language` from the current i18n language. QA test: `fr`, then `en` after a language switch.<br>• Sends the bearer token, except with `auth: false`.<br>• A renewed `Authorization: Bearer …` on a 2xx replaces the stored token. This matches the API's `renew_token_if_due`, which only renews on `response.successful?`. CORS exposes `Authorization`.<br>• `401 unauthorized` clears the token and fires `onUnauthorized`; `401 invalid_credentials` doesn't.<br>• Timeout: 15 s default (QA test with fake timers: no abort at 14.999 s, `timeout` code at 15.001 s).<br>• `network_error` when offline; `unexpected_response` for bodies outside the contract.<br>• `multipart` through `formData`. |
| M-16 Hand-written types | Pass | `src/api/types.ts`. Fixtures in `src/test/fixtures.ts`. |
| M-17 TanStack Query | Pass | `QueryClientProvider` in the root layout. Retry once, never on 4xx. `onlineManager` uses NetInfo; `focusManager` uses AppState. |
| M-18 Token storage | Pass | `expo-secure-store` only, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, key `sparkcircles.auth.token`. Writes are queued so they happen in order. ESLint blocks the AsyncStorage import (probed). QA scan: no `async-storage` in `src/`. The token is never logged: no `console.*` in `src/`, and a QA test spies on every console method through a renewal and a 401. |
| `/up` health check, dev only | Pass | `index.tsx` renders `ApiHealthCheck` only when `__DEV__`. It covers the pending, reachable and error states (designed copy "Impossible de joindre SparkCircles / Vérifie ta connexion et réessaie." with a Small Secondary "Réessayer"). |
| M-21 i18n, French "tu" by default + English | Pass | French unless the phone language starts with `en`. Keys are typed through `i18next.d.ts`. QA test: no "vous/votre/vos" in `fr.json`, sentence case in both languages. Market is "Services" in French and "Market" in English. |
| Section 7 Reduce-motion hook | Pass (BUG-05) | `useReduceMotion` reads `isReduceMotionEnabled` and listens for `reduceMotionChanged`. Skeleton stops pulsing and stays at opacity 1 (QA test). |
| M-22 Checks and scripts | Pass | `lint`, `typecheck`, `test`, `deps:check` and `ci` scripts are present and green. |
| `.env.example`, `.env.local` git-ignored | Pass | `git check-ignore -v .env.local` → `.gitignore:36:.env.*`. `.env.example` is the only env file in the branch history. |
| Mobile CI workflow | Pass | `.github/workflows/mobile.yml`:<br>• Runs on PRs and `main` pushes that touch `mobile/**`, the design-system file or the workflow.<br>• `working-directory: mobile`, Node from `.nvmrc`, npm cache on the lockfile.<br>• Steps: `npm ci`, lint, typecheck, `deps:check`, `jest --ci`, plus an Android bundle smoke test (more than the proposal asks).<br>• `EXPO_PUBLIC_API_URL` is set to `http://localhost:3000`, which isn't a secret.<br>• Same action versions as `api.yml`. |
| M-23 "each [component] with tests" | Partial (BUG-06) | `TabBar` and `Button` have tests. `Icon`, `Notification` and `Skeleton` had none (Notification and Skeleton are only rendered inside `ApiHealthCheck.test`). QA added coverage. |
| M-23 `Button` "all variants and states" | Partial (BUG-08) | Primary, Secondary, Ghost and Destructive are there; Module CTA is missing. Pressed, disabled and loading states are there. |
| M-23 `api/README.md` note (M-5) | **Fail** (BUG-04) | `api/README.md` has no `-b 0.0.0.0` or iPhone note. |
| Spec acceptance criteria | N/A | Infrastructure, no spec. The client's auth behaviour was checked against the AC IDs it cites (AC-3.2, 3.4, 3.6). |

## Design-system compliance

| Rule | Result | Evidence |
|---|---|---|
| Tab colours: Home lavender, Events green, Community sky, Market pink, Travel yellow | Pass | `MODULE_ACCENT` in `navigation/tabs.ts`. QA test asserts the mapping. |
| Active tab: Base fill + Ink icon and label. Inactive: Dark variant (section 10, contrast rule 2) | Pass | QA test runs once per active tab (5 runs). Active tab: `bg-<module>` + `rounded-md` + label `text-ink` + icon `ink`. Every other tab: `bg-transparent` + `text-<module>-dark` + icon `<module>-dark`. Dark variants on Surface give 5.36–5.6:1 (white-on-Dark ratios from DS section 1). |
| Weights 400/500 only | Pass | QA source scan, see above |
| No hard-coded hex outside `tokens.js` | Pass | ESLint rule, plus a QA source scan with comments stripped (one doc comment in `Skeleton.tsx` cites `rgba(0,0,0,0.08)`, which is fine). `app.config.ts` reads the colours from `tokens.js`. The only other hex is `#1A1A1A` in `scripts/export-brand-assets.sh` (shell, outside ESLint), which matches the Ink token. |
| Notification (section 9) | Pass, with BUG-01 | Tinted card `rounded-lg px-lg py-md` (12/16). Coloured dot, or `CircleAlert` in error-dark for errors. Title 13/500 Ink, caption `text-caption` in the accent's Dark. |
| Button (section 5) | Pass, with BUG-08 and BUG-09 | Sizes 14/28 · 15px, 10/20 · 14px, 7/14 · 12px, all 500 weight, `rounded-pill`, `minHeight 44`. Primary pressed: scale 0.97 + 1.5 px green-dark border. Disabled Primary: Shell, dashed Ink 3, Ink 3 text, no opacity (QA test). Loading: spinner, text hidden, same width. |
| Skeleton (section 13) | Pass, with BUG-05 | `bg-border-soft` (rgba 0.08), opacity 0.5 ↔ 1.0, 750 ms each way (1.5 s), ease-in-out |

### Design-system gaps (to flag to the designer, not bugs)

- **DS-GAP-1:** some sizes in section 5 and section 9 have no section 15 token.
  - Notification title 13 px/500 (section 9). The developer used `text-[13px]` and flagged it in a code comment.
  - Large button text 15 px (section 5) uses `text-[15px]`.
  - Neither has a line height defined.
- **DS-GAP-2:** disabled **Destructive** isn't defined.
  - Section 5 gives the generic disabled state (opacity 0.4) and a specific one only for Primary.
  - The developer gave Destructive the Primary disabled look: Shell, dashed Ink 3.
  - That's a sensible choice, because white text at 40 % opacity on error-dark would fail contrast. But it's invented, and the designer should confirm it.
- **DS-GAP-3:** tab label overflow and large text sizes aren't defined.
  - Section 10 asks for 11 px labels "always visible". It doesn't say what happens when a label doesn't fit: truncate, wrap or shrink.
  - It also doesn't say what happens at the largest Dynamic Type sizes (the proposal flagged this in section 7). See BUG-02.
- **DS-GAP-4:** the `label` token adds `letter-spacing 0.06em`. That spacing is for uppercase section headers, while tab labels are just "11px/500".
  - The developer cancels it with `tracking-normal` on tabs, which is reasonable.
  - A separate token would remove the ambiguity.

## Accessibility

| Check | Result | Evidence |
|---|---|---|
| Tab roles and selected state | Pass | Container: `accessibilityRole="tablist"` + label "Sections principales" / "Main sections". It isn't `accessible`, so each tab stays reachable on its own. Tabs: `accessibilityRole="tab"`, `accessibilityState={{ selected }}`, exactly one selected (developer test). |
| Tab labels | Pass | Visible text and `accessibilityLabel`, in French and English. Icons are hidden from accessibility. |
| 44 px targets | Pass | Tabs `minHeight: 44`. Button `minHeight: 44` at every size (QA test). Tabs are `flex-1`, so 55–75 px wide on phones. |
| Button roles and states | Pass | `accessibilityRole="button"`, label, optional hint, `accessibilityState { disabled, busy }`. Presses are ignored when disabled or loading (developer tests). |
| Notification roles and announcements | **Fail** (BUG-01) | Error: `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`, title and caption grouped, action kept separate (QA test). No announcement on iOS. |
| Skeleton | Pass | `accessible={false}` and `importantForAccessibility="no-hide-descendants"` (QA test: hidden from queries). The pending health check exposes "Vérification de l'API…" instead. |
| Reduced motion | Pass, with BUG-05 | Skeleton stops pulsing and shows opacity 1 under reduced motion (QA test). Button press scale is instant, not animated. |
| Contrast | Pass (from tokens) | Every text/background pair used follows the measured pairs in DS section 1: Ink on Base ≥ 9.57, Dark on Surface ≥ 5.36, Dark on Light ≥ 4.51, error-dark on error-light 5.76, Ink 3 on Shell 4.76. |

## Security and hygiene

| Check | Result | Evidence |
|---|---|---|
| No secrets committed | Pass | `git log -p 29fe96b..HEAD` (without the lockfile and PNGs), scanned for AWS/GitHub/Slack/OpenAI key formats, JWTs (`eyJ…`), private-key blocks, 40+ character base64 strings, `EXPO_TOKEN`/`EAS_`: no hits. "token" hits are placeholders in tests only (`'old-token'`, `'renewed-token'`). No `.env`, `.p8`, `.p12`, `.jks` or `.key` file in the history. `.gitignore` covers them. |
| Token never logged | Pass | No `console.*`, logger or Sentry in `src/`. QA test confirms. Tokens appear only in headers and secure store. |
| `EXPO_PUBLIC_` contains no secret | Pass | Only `EXPO_PUBLIC_API_URL` exists: the LAN address in `.env.local`, `localhost` in CI. `.env.example` warns that these values are built into the app. |
| Template's removed files | Pass | `mobile/.claude/`, `mobile/AGENTS.md`, `mobile/LICENSE` (and `CLAUDE.md`) don't exist and were never committed on this branch. `git ls-files` has no `AGENTS.md`, `LICENSE` or `settings.json`. |
| Dependencies match the approved list | Pass, one item to acknowledge | Every direct dependency is in proposal section 10, at the approved version, plus `babel-preset-expo` ~57.0.13 (approved since). Also, `package.json` `overrides` pins **`react-dom` 19.2.3**. It's not a direct dependency: `expo-router` pulls it in for web. The pin is documented in the README "Package notes", but it wasn't in the approved list, so **the PM should acknowledge it**. `@expo/ui` and the Radix packages still come in transitively through `expo-router`, which is expected: the template cleanup removed them as direct dependencies only. |
| Dev API bound to the LAN | Note (BUG-10) | `.claude/launch.json` now always starts Rails with `-b 0.0.0.0`. |

## README run steps (`mobile/README.md`)

| Step | Result |
|---|---|
| Node 22 via `nvm use` | Accurate. The Mac default is Node 18. |
| `.env.local` from `.env.example`, `ipconfig getifaddr en0` | Accurate. The address matches today's `en0`. |
| API with `bin/rails server -b 0.0.0.0`, macOS firewall prompt, no public Wi-Fi | Accurate |
| Expo Go: scan the QR code with Camera, local-network prompt | Accurate |
| "Expo Go … **no account needed**" | **Wrong** (BUG-03). The PM had to sign in to an Expo account. |
| "Check it works": the "API joignable" block and the troubleshooting list | Accurate. Matches the `ApiHealthCheck` copy. |
| Limits of Expo Go | Accurate |
| No Xcode / iOS Simulator | Accurate ("needs Xcode 26.4 or newer") |
| Android emulator alternative (`10.0.2.2`, press `a`, Pixel 3a API 34) | Accurate per proposal M-4. Not run: I didn't start the emulator, and a second Metro would have clashed with the PM's on 8081. |
| Link to `api/README.md` for the API setup | That file has no LAN/iPhone note (BUG-04) |

## Bugs

### BUG-01 · Major · Error notifications aren't announced by VoiceOver on iOS
- **Rule:** proposal section 7: errors are announced with `AccessibilityInfo.announceForAccessibility`. Design system P6 / CLAUDE.md accessibility.
- **Steps:**
  1. iPhone with VoiceOver on, Expo Go.
  2. Stop the API (or set a wrong `EXPO_PUBLIC_API_URL`).
  3. Open the Home tab. The "Impossible de joindre SparkCircles" notification appears.
- **Expected:** VoiceOver reads the error when it appears.
- **Actual:**
  - `Notification.tsx` only sets `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"`.
  - `accessibilityLiveRegion` works on Android only.
  - React Native's `alert` role doesn't make iOS speak a newly mounted view.
  - Nothing calls `announceForAccessibility`, so iOS users get no announcement. Android TalkBack is fine.
- **Evidence:** QA test `BUG-01 announces an Error notification when it appears (VoiceOver)` in `src/__tests__/qa/accessibility.qa.test.tsx`, written as `it.failing`. It passes while the bug exists; when the fix lands, Jest flags it so it can become a normal `it`.
- **Note:** today it only affects the development health check. The component is shared, though, and every error state in the next PRs (login, network, forms) will use it.

### BUG-02 · Major (to confirm on the iPhone) · French tab labels "Communauté" and "Événements" don't fit on iPhone widths
- **Rule:** design system section 10: "Labels: always visible under the icon (never icon-only), 11px/500".
- **Steps:**
  1. iPhone in French, Expo Go.
  2. Look at the tab bar.
- **Expected:** all five labels are readable in full.
- **Actual (measured, not seen on a device):**
  - Each label has `numberOfLines={1}` inside a `flex-1` tab.
  - Text space per tab = (screen width − 32 screen padding − 12 container padding − 1 border) / 5 − 8 tab padding. That's **61.6 px on a 393 pt iPhone**, 58 px on a 375 pt one and 69 px on a 430 pt Pro Max.
  - Label widths, measured with the system San Francisco font (`SFNS.ttf`, Medium, 11 pt): "Communauté" ≈ 70.6 px, "Événements" ≈ 64.7 px.
  - So "Communauté" gets an ellipsis on every iPhone, and "Événements" on all but the Pro Max sizes. In English, "Community" (≈ 60.5 px) is cut on 375 pt phones.
  - At larger Dynamic Type sizes, more labels are cut.
- **PM check:** look at the Community tab on your iPhone now. If it reads "Communa…", the bug is confirmed.
- **Fix:** probably needs the designer (DS-GAP-3). Options: less padding, two-line labels, `adjustsFontSizeToFit` (below 11 px, against the type scale) or shorter French labels.

### BUG-03 · Minor · README says Expo Go needs no account
- **Where:** `mobile/README.md` "Requirements": "Expo Go on your iPhone (free on the App Store, no account needed)". Proposal M-4 step 1 says the same.
- **Expected:** say that Expo Go asks you to sign in to a (free) Expo account the first time. The PM confirmed this on their iPhone.
- **Actual:** it says no account is needed.

### BUG-04 · Minor · `api/README.md` note from M-5 is missing
- **Rule:** proposal M-5 ("I'll add these steps to `api/README.md`") and M-23 ("`mobile/README.md` and the `api/README.md` note (M-5)").
- **Steps:** `grep -n "0.0.0.0\|iPhone\|mobile" api/README.md` returns nothing.
- **Expected:** a short note on `bin/rails server -b 0.0.0.0` (development only, home Wi-Fi, the firewall prompt). `mobile/README.md` links to `api/README.md` for the API setup.
- **Actual:** the note only exists in `mobile/README.md`.

### BUG-05 · Minor · The skeleton pulses briefly under reduced motion
- **Rule:** design system P6 "Respect prefers-reduced-motion for all animations". Proposal section 7.
- **Steps:**
  1. iPhone with Reduce Motion on.
  2. Open Home while the health check is pending (or any future skeleton).
- **Expected:** a static block from the first frame.
- **Actual:**
  - `useReduceMotion` starts as `false` and only learns the real value from the async `isReduceMotionEnabled()`.
  - `Skeleton` starts its pulse loop on mount, then stops it once the value arrives.
  - The pulse runs for a fraction of a second on every mount.
- **Evidence:** in the QA test `stays static … under reduced motion`, the loop is started and then stopped.
- **Fix:** start in an "unknown" state and wait for the value before animating, or read the value once at app start.

### BUG-06 · Minor · `Icon`, `Notification` and `Skeleton` shipped without their own tests
- **Rule:** proposal M-23: "first components … `Icon`, `TabBar`, `Button`, `Notification`, `Skeleton` (with reduced motion), each with tests".
- **Actual:**
  - Only `TabBar.test.tsx` and `Button.test.tsx` exist.
  - Notification and Skeleton are only rendered indirectly in `ApiHealthCheck.test.tsx`.
  - Nothing tested the Skeleton's reduced-motion behaviour, the Notification's roles or the Icon's stroke.
- **Mitigation:** my QA tests now cover these (see "Tests added"). The developer may want to adopt them next to the components.

### BUG-07 · Minor · The no-colour lint rule misses CSS named colours
- **Rule:** CLAUDE.md "No hard-coded hex values in components, use the Tailwind tokens". Design system rule 4: never pure black on a colour.
- **Steps:** lint `style={{ backgroundColor: 'tomato', color: 'black' }}` or `const c = 'red'` in a component (`eslint --stdin --stdin-filename src/components/X.tsx`).
- **Expected:** an error, like `#hex` and `rgba(`.
- **Actual:** no error. Numeric colours (`0xff0000`) also pass.
- **Related:** Tailwind default palette classes (`text-red-500`, `bg-black`) don't exist any more. They now give no style and no error, so a typo fails silently. That's acceptable, but worth knowing.

### BUG-08 · Minor · `Button` has no Module CTA variant
- **Rule:** design system section 5 lists five variants, including "Module CTA → bg: module base · text: ink · radius: pill (e.g. empty states)". Proposal M-23: "`Button` (all variants and states)".
- **Actual:** `ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'`.
- **Note:** no screen needs it yet. It will be needed for module empty states.

### BUG-09 · Cosmetic · Primary pressed border makes the button grow by 3 px
- **Rule:** design system section 5: Primary pressed "scale(0.97) + **inset** border 1.5px green-dark".
- **Steps:** press and hold a Primary button and watch its edges.
- **Expected:** the border appears inside the pill, and the size doesn't change apart from the 0.97 scale.
- **Actual:**
  - The border is added only while pressed (`border-[1.5px] border-green-dark`). React Native counts borders in the box size, so the button gets 3 px wider and taller, which the 0.97 scale partly hides.
  - Its neighbours can shift a little.
  - A transparent 1.5 px border at rest would fix it.

### BUG-10 · Minor · `.claude/launch.json` always binds the dev API to the LAN
- **Rule:** proposal M-5: `-b 0.0.0.0` "in development only … Don't do it on public Wi-Fi".
- **Actual:**
  - Commit `9e52a23` changed the preview launcher from `-b 127.0.0.1` to `-b 0.0.0.0` for every start, on any network.
  - That's still development, but the README's warning only covers the manual command.
  - The Android emulator path doesn't need it either.
- **Expected:** keep `127.0.0.1` by default and opt in to the LAN when testing on the iPhone (e.g. a second launch configuration), or have the PM accept it as is.

## Coverage notes (what I couldn't test)

- **On-device rendering (iPhone, Expo Go):** I can't see the PM's phone. These need a visual check:
  - NativeWind output: line heights, shadows, the 0.5 px border, the dashed disabled border
  - Safe areas
  - Splash hand-off
  - Tab label truncation (BUG-02)
  - The VoiceOver behaviour (BUG-01)

  I checked the class names in component tests, the generated Tailwind CSS (`tailwindcss -c tailwind.config.js`) and css-interop's line-height conversion in the source, not the pixels.
- **Android emulator:** not started. It would need a second Metro, which I was told not to run next to the PM's on 8081. The Android bundle builds.
- **Our icon and splash:** they only show in our own builds (M-6). In Expo Go you see Expo's. I checked the PNGs and the resolved `expo config` only.
- **CI workflow:** not run on GitHub (no PR, local only). I checked each step locally, plus `tsc` without the generated Expo type files.
- **Session wiring and 401 → Log in:** the gate is off until the auth PR (M-9). Covered by unit tests only.
- **Large text sizes, 320 px screens, no network:** not tested on a device. "No network" was checked through the client tests and the health check's error state.
- **`expo-secure-store` config plugin:** in our own builds, it adds a default iOS Face ID usage text. It's not used yet. The permission texts are to be approved with M-25/M-6.

## Regression risks

- **SDK 58 (M-1):** when it ships, Expo Go on the iPhone stops opening this SDK 57 project. Plan the upgrade (`npx expo install expo@^58 --fix`) before it blocks testing.
- **Shared components:** BUG-01 and BUG-05 live in shared components. Every later screen (auth, account, verification) inherits them until they're fixed.
- **Tab bar width:** any longer French label, a sixth tab or a badge on a tab makes BUG-02 worse.
- **API client edge cases** (today they're observations, not bugs):
  - A request the caller aborted (TanStack Query cancellation) is reported as `network_error`.
  - An already-aborted caller signal doesn't stop the request.
  - The 15 s timeout covers waiting for the headers, not reading the body.

  If a later screen shows the "couldn't reach" notification whenever `isOffline` is true, a cancelled query could trigger it by mistake.
- **Token renewal:** relies on the API renewing only on successful responses. If the server ever starts renewing on 4xx responses, the client will ignore those tokens.
- **Design-system document:** `tokens.test.ts` reads section 15 of the design-system document, so any edit to that code block fails the mobile CI until `tokens.js` follows. That's intended. CI is triggered by design-system changes.
- **`react-dom` override:** expo-router upgrades may need the pin updated with React.
- **Dependency audit:** re-run with every SDK patch.

## Tests added (uncommitted, `mobile/src/__tests__/qa/`)

| File | Tests | What they cover |
|---|---|---|
| `designSystem.qa.test.tsx` | 14 | Tab module → accent mapping. Active Base + Ink vs inactive Dark for each of the 5 active tabs. Tab icons. Icon stroke 1.8, token colour, hidden from accessibility. Destructive look. Disabled Primary look. 44 px at every Button size. Source scans: weights 400/500 only, no hex/rgb outside `tokens.js` (comments ignored), no AsyncStorage. |
| `accessibility.qa.test.tsx` | 8 | Error notification role, live region and grouped text. Non-error tint and caption. **BUG-01** (`it.failing`). Skeleton hidden from accessibility, pulses normally, static under reduced motion. French "tu", sentence case. |
| `apiClient.qa.test.ts` | 3 | Accept-Language follows the app language, trailing-slash base URL. 15 s default timeout with the `timeout` code. Token never logged through a renewal and a 401. |

All 25 pass, and they pass lint, Prettier and `tsc`. Full suite: 13 suites, 71 tests, all pass.

I can open GitHub issues for the two major bugs (BUG-01, BUG-02) with `gh issue create` if the PM wants. I haven't created any.

**Bug counts:** blocker 0 · major 2 (BUG-01, BUG-02) · minor 7 (BUG-03 to BUG-08, BUG-10) · cosmetic 1 (BUG-09). Plus 4 design-system gaps (DS-GAP-1 to 4).
