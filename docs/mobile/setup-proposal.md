# Mobile setup proposal (`mobile/`)

> Author: developer · Date: 2026-10-03 · **Status: approved by the PM on 2026-10-03.** Every decision below is approved; the PM's choices are written in. The skeleton in `mobile/` is set up per section 9 (M-23).
>
> Serves: [`specs/accounts-and-verification.md`](../specs/accounts-and-verification.md) and [`design/accounts-and-verification.md`](../design/accounts-and-verification.md) (both approved), the API contract [`api/accounts-and-verification.md`](../api/accounts-and-verification.md), and the design system [`SparkCircles_Design_System_EN.md`](../SparkCircles_Design_System_EN.md) v1.4. Same format as the [backend setup proposal](../api/backend-setup-proposal.md).
>
> Legend: **Approved** = PM accepted the recommendation (or chose the option written in). Section 11 records the PM's answers.

---

## 1. Versions (checked on 2026-10-03 with `npm view` and the Expo docs)

| | Latest stable | Proposed |
|---|---|---|
| Expo SDK | 57 (`expo` 57.0.26, released 30 Jun 2026; SDK 58 is only a preview, `next` tag) | **SDK 57** |
| React Native | 0.86.3 (bundled with SDK 57; New Architecture only) | 0.86.3 |
| React | 19.2.3 | 19.2.3 |
| TypeScript | 7.0.2 exists, but Expo's SDK 57 templates pin **~6.0.3** | ~6.0.3 (Expo's choice) |
| Node | Expo SDK 57 requires **Node ≥ 22.13** | **22** (22.23.3 is already installed via nvm) |

- **M-1 Approved:** **Expo SDK 57**, the versions above, `npx expo install` to pick every Expo-managed package version.
  - Alternative: wait for SDK 58 (not stable yet).
  - **Trade-off to know:** the Expo Go app in the App Store only runs the newest SDK. When SDK 58 ships (probably within weeks), Expo Go on an iPhone will stop opening an SDK 57 project. Then I upgrade the project (`npx expo install expo@^58 --fix`, usually a few hours) or we move to a development build (M-6). On Android, the Expo CLI can still install the older Expo Go.
- **M-2 Approved:** **Node 22**, `mobile/.nvmrc` containing `22`. Your Mac's default Node is 18, which is too old: run `nvm use` in `mobile/` (the README will say so). CI reads the same file.
  - Alternative: Node 24, the current LTS (`nvm install 24` first). Node 22 is supported until April 2027, which is enough for now.
- **M-3 Approved:** **npm** (comes with Node, `package-lock.json` committed). `mobile/` is a standalone project, not an npm workspace.
  - Alternatives: pnpm, Yarn or Bun. Faster, but Expo works most smoothly with npm, and there's nothing to share with `api/`.

## 2. How you run the app on this Mac

What I checked (read-only):

| Tool | State |
|---|---|
| Xcode | `/Applications/Xcode.app` (its bundle says version 27.0, not 16.1) is selected by `xcode-select`, but `xcodebuild` and `simctl` **fail to load their libraries** ("Error loading required libraries… reinstall"). **No iOS Simulator, no local iOS build today.** Expo SDK 57 needs Xcode 26.4 or newer. |
| Android | Android Studio 2023.2 installed, SDK in `~/Library/Android/sdk` (platform 34, build tools 34), `adb` and `emulator` work, one emulator already exists (**Pixel 3a, Android 14**), Java 17 installed. **Works today for Expo Go.** |
| Network | Mac's Wi-Fi address today: `192.168.1.77` (can change when the router restarts). |

- **M-4 Approved (iPhone):** **Main path: Expo Go on your own phone, over your Wi-Fi.**
  1. Install **Expo Go** from the App Store or Google Play (free, no account needed).
  2. Terminal 1: `cd api && bin/rails server -b 0.0.0.0` (the API listens on the network, not only on `localhost`).
  3. Terminal 2: `cd mobile && nvm use && npx expo start`, then scan the QR code (iPhone: the Camera app; Android: Expo Go's scanner). The phone and the Mac must be on the **same Wi-Fi**.
  4. Edits appear on the phone within a second (fast refresh).
  - Why: it works today without Xcode, it's a real device (camera for verification, real keyboard, real text sizes), and it costs nothing.
  - **Limits of Expo Go**, honestly: only the native libraries included in Expo Go can be used (everything I propose in section 10 is included); the app shows Expo Go's icon and name, not ours; **iOS permission prompts show Expo Go's text**, not ours; links like `https://sparkcircles…` can't open Expo Go (universal links need our own build); guest or office Wi-Fi often blocks phone-to-Mac traffic (`--tunnel` only helps for the app code, not for the Rails API).
  - **Also works today: the Android emulator on the Mac.** `npx expo start`, press `a`: Expo installs Expo Go in the Pixel 3a emulator. Inside the emulator the API is `http://10.0.2.2:3000` (no network setup at all). Handy without a phone; the camera is simulated.
  - Blocked: iOS Simulator, until Xcode is reinstalled (M-6).
- **M-5 Approved:** **Reaching the API from the phone.**
  - `mobile/.env.local` (git-ignored) holds `EXPO_PUBLIC_API_URL=http://192.168.1.77:3000`; a committed `mobile/.env.example` explains it (`ipconfig getifaddr en0` gives the address). `EXPO_PUBLIC_` values are built into the app: never a secret there.
  - Rails: `-b 0.0.0.0` in development only. Rails' development host check already accepts IP addresses, and **CORS doesn't apply to native apps** (only browsers), so no API code change. The first time, macOS may ask to allow incoming connections for `ruby`: allow it.
  - Trade-off: while it runs, other devices on your Wi-Fi can reach the development API (seed data only). Don't do it on public Wi-Fi.
  - I'll add these steps to `api/README.md` and the new `mobile/README.md` (docs only).
- **M-6 Approved:** **Later: our own builds.** Needed for: universal links in emails, our icon and permission texts, push notifications (backlog #17), and testing what store users will get.
  - Recommended: **fix Xcode first** (you reinstall or update Xcode 26.4+ from the App Store; it's a system change I won't make), which also brings back the iOS Simulator. Then a **development build** (`npx expo run:ios` / `run:android`, adds `expo-dev-client`).
  - Alternative: **EAS Build** (Expo's cloud builds): no local Xcode needed, free tier is enough for a prototype. Needs a free Expo account, and for installing on an iPhone an **Apple Developer Program** membership (99 €/year); Android needs nothing.
  - Both can wait: nothing in the setup PR needs them. Universal links will (M-19).

## 3. Project structure and navigation

- **M-7 Approved:** **Expo Router** (file-based routing, Expo's default, built on React Navigation).
  - Why: each screen is a file, like Rails routes; **deep links work automatically** (`/confirm-email?token=…` opens `src/app/confirm-email.tsx`), which the accounts flows need for confirmation, password reset and "This wasn't me"; typed routes; protected route groups for the auth gate.
  - Alternative: React Navigation directly. Same engine, but deep links and route types are configured by hand.
- **M-8 Approved:** **Layout**

```
mobile/
  .nvmrc  .env.example  app.config.ts  package.json  tsconfig.json
  babel.config.js  metro.config.js  tailwind.config.js  global.css
  jest.config.js  eslint.config.js  .prettierrc  README.md
  assets/brand/            PNG app icon, adaptive icon layers, splash (exported, section 4)
  scripts/export-brand-assets.sh
  src/
    app/                   routes only (thin files)
      _layout.tsx          providers: safe area, i18n, query client, session; splash until ready
      (auth)/              welcome, sign-up, check-inbox, log-in, forgot-password… (next PR)
      (tabs)/_layout.tsx   our TabBar
      (tabs)/index.tsx     Home   · events.tsx · community.tsx · market.tsx · travel.tsx
      account/…            My account screens (next PR)
      verification/…       verification flow (next PR)
      confirm-email.tsx  reset-password.tsx  this-wasnt-me.tsx   email link targets (next PR)
    screens/               screen bodies, grouped by area (auth/, account/, verification/, home/…)
    components/            named after the design system: Button, Badge, TabBar, Header, TextField,
                           Checkbox, RadioList, Notification, Toast, BottomSheet, Avatar, IconSquare,
                           SettingsList, EmptyState, Skeleton, SuccessCheckmark, Icon, Wordmark…
    api/                   client.ts (fetch wrapper), errors.ts, types.ts, one file per resource
    auth/                  tokenStore.ts (secure storage), SessionProvider.tsx, useSession.ts
    hooks/                 useReduceMotion, useOnline…
    i18n/                  index.ts, fr.json, en.json
    theme/                 tokens.js (section 15 values, the only file with hex codes)
    test/                  Jest setup, render helper, fixtures copied from the API contract
```

  Tests sit next to the code (`Button.test.tsx`).
- **Tab bar**: the 5 tabs of design system section 10, fixed order: Home (`home`, lavender), Events (`sparkles`, green), Community (`users`, sky), Market (`shopping-bag`, pink), Travel (`key`, yellow). Custom `TabBar` component: white container, radius 16, padding 6, 0.5 px border, level-1 shadow; active tab = module Base fill + Ink icon and label, radius 12; inactive = module Dark; labels always visible (11/500), icons 20 px stroke 1.8, ≥ 44 px tall, `accessibilityRole="tab"` and selected state. (The `sparkles` icon is an open design decision; switching later is a one-line change.)
- **Auth gate**: the root layout reads the session. No token → `(auth)` group (Welcome first). Token → `GET /me`, then by account state: email not confirmed → Check your inbox (S3, AC-2.3); closure pending → S10; new terms → S9; otherwise the tabs. A `403` gate code mid-session sends the user to the same screens. Account and auth screens use the neutral base (no module accent).
- **M-9 Approved:** **The gate is switched on in the next PR**, with the login screens. In the setup PR the tabs open directly (otherwise you couldn't see anything without a login screen); the session and token modules are built and tested, just not wired to a screen yet.
  - Alternative: include Welcome and Log in in the setup PR. Mixes feature screens into the setup review.

## 4. Design tokens, fonts, icons, brand assets

- **M-10 Approved:** **NativeWind 4.2.7 with Tailwind CSS 3.4** (`tailwindcss` 3.4.19, the v3 long-term line). Section 15 is a Tailwind 3 config, so it drops in as is.
  - Alternatives: NativeWind 5 (Tailwind 4) is still a release candidate, not for a new project; Uniwind (newer, smaller community); plain `StyleSheet` with a tokens file (no `className`, against CLAUDE.md).
- **M-11 Approved:** **`tailwind.config.js` = section 15, values unchanged.** The values live once in `src/theme/tokens.js`; `tailwind.config.js` imports it, and so does the little code that needs raw values (icon colors, status bar, app config). An ESLint rule fails the build on any hex color (`#…`) or `rgba(` outside that file, so "no hard-coded hex in components" is checked by CI, not by memory. Three points to flag:
  1. **Section 15 vs its own note. PM decision: only SparkCircles colours, under `theme.colors`** (the designer updated section 15 to v1.4.1 with `white`, `transparent` and `current`). The note says only SparkCircles colors should exist, but the config puts colors under `extend`, which **keeps** Tailwind's default palettes (`green-500`, `red-600`, `sky-300`…). I recommend placing the same colors under `theme.colors` (plus `white`, `transparent`, `current`) so the defaults disappear and nobody can use an off-palette shade. Same values, it only matches the note. Alternative: keep `extend` literally and rely on the ESLint rule and reviews. If you agree, the designer may want to update section 15 to match; I won't edit the design system.
  2. **Native quirks to check during setup**: React Native wants line heights in pixels; if NativeWind doesn't convert the unitless ones (`1.2`), I'll write the computed pixel values in the config (H1 28 × 1.2 = 33.6) and say so in the PR. Same check for the shadows (`card`, `modal`, `float`), which React Native 0.86 supports as `boxShadow`.
  3. NativeWind's root size is set to **16 px** so Tailwind's default sizes match the design (e.g. `min-h-11` = 44 px touch target).
- **Light mode only** (`userInterfaceStyle: "light"`): the design system defines no dark theme. Dark mode would be its own design task.
- **M-12 Approved:** **Fonts: system font**, as section 2 says (San Francisco on iOS, Roboto on Android), weights 400 and 500 only. No font package, nothing to load.
- **M-13 Approved:** **Icons: `lucide-react-native` + `react-native-svg`.** One `Icon` wrapper sets `strokeWidth={1.8}` and takes a token name for the color (`ink-2`, `green-dark`…), so no icon gets a hex value.
- **M-14 Approved:** **App icon and splash from `docs/design/brand/ripple/`.** Expo needs PNGs, not SVGs. A script `mobile/scripts/export-brand-assets.sh` converts the delivered SVGs with `rsvg-convert` (already installed through Homebrew, no npm package) and the PNGs are committed in `mobile/assets/brand/`. Re-run the script whenever `build_ripple.py` regenerates the SVGs; I never edit the artwork.

  | Expo setting | Source SVG | PNG |
  |---|---|---|
  | `icon` / `ios.icon` (light and dark) | `ripple-icon-1024.svg` | 1024×1024, opaque, square (iOS rounds it) |
  | `ios.icon` tinted | `ripple-icon-tinted-1024.svg` | 1024×1024 |
  | `android.adaptiveIcon.foregroundImage` | `ripple-icon-foreground.svg` (ripple inside the 66 dp safe circle) | 1024×1024, transparent |
  | `android.adaptiveIcon.backgroundColor` | `ripple-icon-background.svg` is plain Ink | Ink `#1A1A1A`, read from `tokens.js` |
  | `android.adaptiveIcon.monochromeImage` | `ripple-icon-mono.svg` | 1024×1024 (themed icon) |
  | splash (`expo-splash-screen`) | `ripple-lockup-stacked.svg` or `-on-dark.svg` | 1024 px wide, shown at about 200 px |

  - `ripple-icon-small-1024.svg` isn't used: iOS and Android generate small sizes from one master and can't swap artwork per size.
  - **Splash look. PM decision: (a) stacked lockup on Shell.**, which the design system doesn't define: (a) **recommended** stacked lockup on **Shell** (`#F8F7F4`), the same background as the first screen, so there's no flash between splash and Welcome; or (b) stacked lockup on **Ink**, matching the dark app icon. The designer may want to weigh in.
  - Our icon and splash only show in our own builds; in Expo Go you see Expo's.

## 5. Authentication and the API client

- **M-15 Approved:** **A small typed `fetch` wrapper** in `src/api/client.ts`, no axios. It:
  - prefixes `EXPO_PUBLIC_API_URL` + `/api/v1`, sends JSON, `Accept-Language` (current app language) and `Authorization: Bearer <token>`;
  - **saves a renewed token**: if a response carries `Authorization: Bearer …` (contract section 1, AC-3.4), it replaces the stored token;
  - turns every failure into one typed `ApiError` (`status`, `code`, `message`, `details`), plus `network_error` and `timeout` (15 s) for the offline case;
  - sends `multipart/form-data` for the verification upload (`FormData` with the photo files).
  - Alternative: axios (interceptors, upload progress). One more package for what `fetch` already does; the design has no upload progress bar.
- **M-16 Approved:** **Types written by hand from the contract** in `src/api/types.ts` (`Me`, `Verification`, `PublicProfile`, error codes and field error keys as string unions), each with the contract section it comes from. Tests parse JSON fixtures copied from the contract, so a contract change breaks a test.
  - Alternative: generate types from an OpenAPI file. The backend chose markdown contracts only (D-30), so it would need a new gem (e.g. rswag) and spec changes.
- **M-17 Approved:** **TanStack Query** (`@tanstack/react-query`) for data from the API: loading, error and retry states, refresh when the app comes back to the foreground, pause when offline. Every screen in the design has loading, error and empty states; this gives them one consistent pattern.
  - Alternative: hand-written `useEffect` hooks per screen. No package, but each screen re-implements loading, errors and retries, which is where bugs hide.
- **M-18 Approved:** **Token storage and sessions**
  - The token lives only in **`expo-secure-store`** (iOS Keychain, Android Keystore), "after first unlock, this device only", so it's never in an iCloud or Google backup. Never AsyncStorage; an ESLint rule blocks importing AsyncStorage.
  - `device_name` sent at login: the **phone model** from `expo-device` ("iPhone 15", "Pixel 8"), not the phone's own name, which often contains the person's first name ("iPhone de Claire"). Nobody sees it in v1; it will help a future "active devices" list (backlog #14).
  - **Log out (this device)**: `DELETE /sessions/current`, then the token is deleted on the phone **even if the request fails** (offline): the server-side token then dies after 30 days without use. **Log out everywhere**: `DELETE /sessions`, then the same.
  - **401 `unauthorized`** on any authenticated request (revoked, expired, logged out elsewhere): delete the token, clear cached data, go to Log in (AC-3.4, 3.6). `401 invalid_credentials` and `423 account_locked` stay on the login form as the designed error notifications. **Small design gap:** there's no copy for "you were logged out" when this happens mid-session; I'll show Log in without a message unless the designer adds one.
  - Known edge: on iOS, the Keychain survives uninstalling the app, so a reinstall can start logged in if the token is still valid. Acceptable (it's the same person's phone); a fix needs one more package.
- **M-19 Approved:** **Email links (confirmation, password reset, "This wasn't me")**
  - The backend builds links as `APP_LINK_BASE/confirm-email?token=…`, `/reset-password?token=…`, `/this-wasnt-me?token=…`. Expo Router routes with the **same paths** read the token, send it in the request **body** (contract rule), and then replace the route so the token doesn't stay in navigation history. Tokens are never logged.
  - `APP_LINK_BASE` per environment (an environment variable, no code change): **Expo Go** `exp://192.168.1.77:8081/--`; **our development build** `sparkcircles://` (app scheme `sparkcircles`); **production** `https://<app domain>` as **universal links / Android App Links**, which need the app domain (already an open PM decision), two small files served by Rails (`apple-app-site-association`, `assetlinks.json`) and a small web page for people who open the link on a computer. Custom schemes alone are not enough in production: some mail apps (Gmail) don't open them.
  - **Development emails** aren't delivered today (`delivery_method = :test`), so you can't tap a real link. For the next PR I'll propose a development-only way to read them from the phone (e.g. the `letter_opener_web` gem, a new gem to approve then).
- **M-20 Approved:** **Offline and errors**: `@react-native-community/netinfo` tells the app when it's offline; the designed Error notification "We couldn't reach SparkCircles / Check your connection and try again." with "Try again" appears instead of a dead screen. Forms keep what was typed; verification photos stay on the phone until the upload succeeds (design V4). Messages come from the app's own copy keyed by the API `code` and field keys (`too_short`, `must_be_accepted`…), with the API `message` only as a fallback.

## 6. Languages (French "tu" + English)

- **M-21 Approved:** **`i18next` + `react-i18next` + `expo-localization`.**
  - French by default; English if the phone is set to English. The Welcome screen's "Français / English" link switches it.
  - Once logged in, the account's `locale` (from `GET /me`) wins, and switching language saves it with `PATCH /me` so emails follow. Before login, the choice is remembered in secure storage (a tiny non-secret value, to avoid another package).
  - Every request sends `Accept-Language: fr|en`, which the API reads (first two letters); sign-up also sends `locale`.
  - Copy in `src/i18n/fr.json` and `en.json`, keys typed so a missing key fails `tsc`; plurals and bold or linked parts ("We've sent a link to **c•••@gmail.com**") handled by the library; dates with the phone's built-in `Intl` ("2 oct. 2026" / "2 Oct 2026").
  - Alternative: `i18n-js` (one package instead of two, but no typed keys or rich text).
  - **French copy. PM decision: option (a)**, I draft it with "tu", reviewed in the PR. The approved design gives English copy only ("French copy is needed for launch"). For the next PR, who writes French: (a) **recommended** I draft it with "tu" following section 19 and you or the designer review it in the PR; or (b) the designer delivers a French copy table first.

## 7. Accessibility and reduced motion

Enforced in the shared components, so screens get it for free, and checked by tests:
- **44 px targets**: `Button`, `IconButton`, tab items, checkbox and radio rows have a 44 px minimum height built in; small visuals (badges, the 16 px shield icon) get `hitSlop` to reach 44 px.
- **Labels**: `IconButton` requires an `accessibilityLabel` in its TypeScript type (it won't compile without one: "Back", "Close", "Show password", "Take the photo"); `TextField` always renders its visible label and links helper and error text to the field; badges carry their meaning ("Verified, identity checked by SparkCircles. Opens an explanation.").
- **Roles and states**: `accessibilityRole` (button, link, tab, checkbox, radio, header) and states (`disabled`, `checked`, `selected`) on every interactive component. Disabled Primary is announced as disabled, as the design asks.
- **Errors**: icon + text, never color alone; focus moves to the first field in error and the message is announced (`AccessibilityInfo.announceForAccessibility`, React Native's equivalent of `aria-live`).
- **Reduced motion**: one `useReduceMotion()` hook (`AccessibilityInfo.isReduceMotionEnabled` plus its change listener). Skeleton shimmer becomes static, the success checkmark and toasts appear without animation.
- **Text size**: the design system doesn't say how screens behave when the user enlarges system text (iOS Dynamic Type, Android font size). I'll leave system scaling on (the accessible default) and test at the largest sizes; flagged for the designer.
- Tests query by role and label (`getByRole('button', { name: 'Log in' })`), so a missing label fails a test.

## 8. Testing and quality

- **M-22 Approved:** **Checks, all run locally and in CI**
  - **Jest** with the `jest-expo` preset (Jest 29, the version it supports) + **React Native Testing Library** 14. Tests named with AC IDs (`AC-3.2 shows the same message for wrong email or password`). `fetch` and secure storage are mocked in tests.
  - **ESLint** with Expo's config (`eslint-config-expo`, ESLint 9) plus our rules: no hex colors or `rgba(` outside `theme/tokens.js`, no AsyncStorage, no direct `fetch` outside `src/api/`.
  - **Prettier** for formatting (with `eslint-config-prettier` so they don't fight). Alternative: ESLint only, formatting left to the editor.
  - **TypeScript** strict, `npx tsc --noEmit`.
  - `npx expo install --check`: fails if a package version doesn't match SDK 57.
  - Scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run ci` (all of them).
- **GitHub Actions**: `.github/workflows/mobile.yml`, like `api.yml`: runs only on `mobile/**` changes, Node from `mobile/.nvmrc`, `npm ci`, then lint, typecheck, `expo install --check`, Jest. No Dependabot (same as the API).

## 9. Scope of the pull requests

- **M-23 Approved:** **Setup PR** (`feat/mobile-setup`, this branch):
  - `create-expo-app` with the SDK 57 template, cleaned of the template's demo screens and of packages we don't use (web support, `expo-image`, `expo-symbols`, `expo-glass-effect`, `@expo/ui`);
  - NativeWind + `tailwind.config.js` from section 15 + `theme/tokens.js` + the hex-color lint rule;
  - app shell: root layout, safe areas, splash held until ready, **TabBar with the 5 tabs** and placeholder screens (tab name as H1 only; no invented copy);
  - first components needed by the shell: `Icon`, `TabBar`, `Button` (all variants and states), `Notification`, `Skeleton` (with reduced motion), each with tests;
  - i18n with `fr.json` / `en.json` (tab labels only) and the language detection;
  - API client with types for errors and `me`, and a **health ping to `/up`**, shown on the Home placeholder in development only ("API reachable" / the error notification), so you can check the phone sees the API;
  - secure token store, session provider and 401 handling, unit tested (not wired to screens yet, M-9);
  - brand asset export script + PNGs, app icon and splash in `app.config.ts`;
  - Jest, ESLint, Prettier, `tsc`, `mobile.yml`; `mobile/README.md` and the `api/README.md` note (M-5).
- **M-24 Approved, option (a) three PRs:** **Next: the mobile screens of the approved accounts-and-verification spec**, on top of the setup PR: auth (S1–S10, gate on, email links), My account (A1–A8, B1 badge sheet), verification (V0–V5). That's about 25 screens. (a) **recommended**: three PRs (auth, then account, then verification), each reviewed and QA'd on its own, all under the same spec; or (b) one PR as CLAUDE.md's "one PR per feature" rule says (the backend part already shipped in PR #2), which would be a very large review.
  - Notes for that work: **Today isn't built yet**, so the "My account" avatar entry goes on the Home placeholder; **Events isn't built either**, so the verification gate V0 is reached only from My account until the Events feature exists.
- **M-25 Approved:** **Camera for the ID document and selfie** (verification PR):
  - **`expo-camera`** for the capture screens: our own capture frame, dashed guide, tips and 64 px shutter, exactly as designed (V2, V3), front camera for the selfie. No microphone (disabled in the config).
  - **`expo-image-picker`** for "Choose from my photos" (uses the system photo picker, no full photo-library access needed).
  - **`expo-image-manipulator`** to shrink photos (about 2,000 px on the long side, JPEG) before upload: faster on mobile data, well under the 10 MB limit, still sharp for the admin. The server already strips metadata and re-encodes.
  - Photos are taken into the app's private cache, never saved to the camera roll, and deleted after a successful upload.
  - **Permission texts to approve** (shown by iOS and Android in our own builds; Expo Go shows its own):
    - Camera, EN: "SparkCircles uses your camera to take photos of your ID and a selfie when you verify your identity." FR: "SparkCircles utilise ton appareil photo pour photographier ta pièce d'identité et prendre un selfie quand tu vérifies ton identité."
    - Photos, EN: "SparkCircles opens your photos only when you choose a picture of your ID." FR: "SparkCircles accède à tes photos seulement quand tu choisis une photo de ta pièce d'identité."
  - The camera-denied state uses the designed copy ("SparkCircles needs your camera to take the photo" + "Open settings").

## 10. Packages to approve

Versions in `~` are chosen by `npx expo install` to match SDK 57. Everything below is supported in Expo Go.

**Setup PR: app**

| Package | Version | Why |
|---|---|---|
| `expo` | ~57.0.26 | The Expo SDK |
| `react`, `react-native` | 19.2.3, 0.86.3 | The UI framework (pinned by the SDK) |
| `expo-router` | ~57.0.24 | File-based navigation and deep links (M-7) |
| `react-native-screens`, `react-native-safe-area-context` | ~4.26.0, ~5.7.0 | Required by Expo Router (native screens, notch and home-bar spacing) |
| `expo-linking`, `expo-constants` | ~57.0.11, ~57.0.20 | Required by Expo Router (links, app config at runtime) |
| `expo-status-bar` | ~57.0.1 | Status bar style per screen |
| `expo-splash-screen` | ~57.0.9 | Our splash, held until the session is loaded |
| `expo-system-ui` | ~57.0.4 | Shell background behind screens, light mode on Android |
| `nativewind` | 4.2.7 | Tailwind classes in React Native (M-10) |
| `react-native-reanimated`, `react-native-worklets` | 4.5.1, 0.10.1 | Required by NativeWind; reduced-motion-aware animations (shimmer, checkmark) |
| `lucide-react-native` | ^1.51.0 | Lucide icons |
| `react-native-svg` | 15.15.4 | Draws the icons and the SVG wordmark |
| `expo-secure-store` | ~57.0.4 | Token in the Keychain / Keystore (M-18) |
| `expo-device` | ~57.0.2 | Phone model for `device_name` (M-18) |
| `expo-localization` | ~57.0.2 | Phone language (M-21) |
| `i18next`, `react-i18next` | ^26.4.2, ^17.0.15 | Translations (M-21) |
| `@tanstack/react-query` | ^5.104.1 | Loading, error, retry and offline states for API data (M-17) |
| `@react-native-community/netinfo` | 12.0.1 | Online / offline detection (M-20) |

**Setup PR: development only**

| Package | Version | Why |
|---|---|---|
| `typescript`, `@types/react` | ~6.0.3, ~19.2.2 | TypeScript (versions from Expo's template) |
| `tailwindcss` | 3.4.19 | Reads `tailwind.config.js` for NativeWind |
| `jest`, `@types/jest`, `jest-expo` | ^29.7, ^29.5, ~57.0.5 | Test runner with Expo's preset |
| `@testing-library/react-native`, `test-renderer` | ^14.0.1, ^1.3.0 | Component tests (the second is required by the first) |
| `eslint`, `eslint-config-expo` | ^9, ^57.0.2 | Linting with Expo's rules |
| `prettier`, `eslint-config-prettier` | ^3.9.9, ^10.1.8 | Formatting |

**Later PRs (approve now or when they come)**

| Package | When | Why |
|---|---|---|
| `expo-web-browser` | auth PR | Terms and privacy policy in an in-app sheet without losing the sign-up form (S2) |
| `react-native-gesture-handler` (~2.32.0) | account PR | Swipe down to close bottom sheets (design section 10) |
| `expo-camera`, `expo-image-picker`, `expo-image-manipulator` | verification PR | Capture, photo picker, resize (M-25) |
| `expo-dev-client` | when we leave Expo Go (M-6) | Development builds |
| Gem `letter_opener_web` (API, development only) | auth PR | Read development emails and tap their links on the phone (M-19) |

Not proposed: axios, a form library (the longest form has 4 fields), AsyncStorage, analytics or crash reporting (AC-10.6; to decide before launch), web support.

## 11. PM decisions (2026-10-03)

1. **M-1** Expo SDK 57: approved, accepting that Expo Go on iPhone will need a project upgrade when SDK 58 ships.
2. **M-4** The PM tests on an **iPhone** with Expo Go from the App Store; the Android emulator is the backup.
3. **M-5** Approved: the development API is exposed on the home Wi-Fi (`bin/rails server -b 0.0.0.0`, development only).
4. **M-11** Only SparkCircles colours: colours under `theme.colors`, not `extend`. The designer updated section 15 (v1.4.1) with `white`, `transparent` and `current`.
5. **M-14** Splash: stacked lockup on Shell.
6. **M-17** TanStack Query approved.
7. **M-21** I draft the French copy with "tu"; it's reviewed in the PR.
8. **M-24** The accounts mobile screens come in three later PRs (auth, account, verification).
9. **M-25** Permission texts: approved with the verification PR.
10. **Packages**: every setup package in section 10 approved (app and development only). Later-PR packages get approved with those PRs.
11. **Still open, not blocking:** reinstall or update Xcode to 26.4+ (PM, system change); Expo account and Apple Developer Program if we use EAS Build (M-6); the app domain for universal links.
