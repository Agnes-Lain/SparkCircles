# SparkCircles mobile app

React Native app built with Expo SDK 57, TypeScript, Expo Router, NativeWind (the design system tokens) and Lucide icons. Setup decisions: [`docs/mobile/setup-proposal.md`](../docs/mobile/setup-proposal.md).

## Requirements

- **Node 22**. The Mac's nvm default is Node 18, which is too old, so run `nvm use` in `mobile/` first (it reads `.nvmrc`).
- **Expo Go** on your iPhone (free on the App Store) and a **free Expo account**: Expo Go on an iPhone may ask you to sign in, and the CLI then needs the same account (see step below).
- The Rails API from `api/`, set up as described in [`api/README.md`](../api/README.md).

## Open the app on your iPhone (Expo Go)

The iPhone and the Mac must be on the **same Wi-Fi** network. Guest and office networks often block this.

**First time only**

```bash
cd mobile
nvm use
npm install
cp .env.example .env.local
ipconfig getifaddr en0          # prints the Mac's Wi-Fi address, e.g. 192.168.1.77
```

Open `mobile/.env.local` and set `EXPO_PUBLIC_API_URL=http://<that address>:3000`. The file is git-ignored. Everything in `EXPO_PUBLIC_` is built into the app, so never put a secret there. The address can change when the router restarts: run `ipconfig getifaddr en0` again and update the file.

Sign in with your free Expo account (create one at https://expo.dev/signup if needed), once on the Mac and once in Expo Go on the iPhone, with the same account:

```bash
npx expo login        # in mobile/; `npx expo whoami` shows who is signed in
```

**Every time**

Terminal 1, the API, listening on the Wi-Fi (development only):

```bash
cd api
bin/rails server -b 0.0.0.0
```

The first time, macOS may ask whether `ruby` can accept incoming connections: click **Allow**. While this runs, other devices on your Wi-Fi can reach the development API (seed data only), so don't do it on public Wi-Fi.

Terminal 2, the app:

```bash
cd mobile
nvm use
npx expo start
```

Scan the QR code with the iPhone's **Camera** app, then tap the banner to open it in Expo Go. The first time, iOS asks whether Expo Go may find devices on your local network: tap **Allow**. Changes you save appear on the phone within a second. Press `r` in the terminal to reload, `Ctrl+C` to stop.

**Check it works:** the app opens on the Welcome screen ("Créer mon compte" / "Me connecter"). Once you're logged in, the Home tab shows a "Développement" block that says **API joignable** (or **API reachable** in English). If the app shows "Impossible de joindre SparkCircles" instead:

- the API isn't running, or was started without `-b 0.0.0.0`;
- `EXPO_PUBLIC_API_URL` has an old address (after editing `.env.local`, restart with `npx expo start --clear`);
- the phone is on another network, or the Mac's firewall blocks `ruby`.

The app follows the phone's language: English if the iPhone is set to English, French otherwise.

**Limits of Expo Go:** you see Expo Go's icon and splash, not ours, and iOS permission prompts show Expo Go's text. Only libraries bundled in Expo Go can be used (everything in `package.json` is). Our own icon, splash, permission texts and universal links need a development build (proposal M-6).

## Try the account screens on the iPhone (development)

The auth gate is on: without a session the app opens on Welcome; with one it opens the tabs, even after you close and reopen it. Development emails aren't sent: the API keeps them, and you read them in a browser with clickable links, at **`http://<Mac Wi-Fi address>:3000/letter_opener`** (Safari on the iPhone) or `http://localhost:3000/letter_opener` (the Mac). Links in those emails open the app in Expo Go: `exp://<Mac Wi-Fi address>:8081/--/confirm-email?token=…` (and `/reset-password`, `/this-wasnt-me`, `/forgot-password`).

1. **Sign up**: Welcome → "Créer mon compte", fill in the form, tick the two required boxes, "Créer mon compte". You land on "Consulte ta boîte mail".
2. **Confirm**: on the iPhone, open Safari at `http://<Mac Wi-Fi address>:3000/letter_opener`, tap the newest email ("Confirme ton e-mail"), then its button. iOS asks to open Expo Go: accept. The app opens logged in on Home, with the checkmark and the toast "E-mail confirmé. Bienvenue sur SparkCircles !". (On the Mac, links can't open the phone's app: use the iPhone's Safari for this step.)
3. **Log out**: "Me déconnecter" at the bottom of Home (temporary, development only, until the My account screens). You're back on Welcome with "Tu es déconnecté·e".
4. **Log in**: Welcome → "Me connecter", email and password. A wrong password shows "L'e-mail ou le mot de passe ne correspond pas".
5. **Forgot password**: Log in → "Mot de passe oublié ?", your email, "Envoie-moi un lien". Open the newest email in letter_opener ("Réinitialise ton mot de passe"), tap its button: the app opens on "Choisis un nouveau mot de passe". Save it: you're logged in, other devices are logged out.

Close and reopen Expo Go while logged in: Welcome is skipped (AC-3.4).

**Where the link address comes from.** In development the API builds email links from `exp://<first private IPv4 of the Mac>:8081/--`, the address Metro serves on (the one in the QR code). Set `APP_LINK_BASE` before starting the API to use another value, then restart it:

```bash
APP_LINK_BASE="exp://192.168.1.77:8081/--" bin/rails server -b 0.0.0.0    # another address or port
APP_LINK_BASE="exp://10.0.2.2:8081/--" bin/rails server                    # Android emulator
```

With `npx expo start --tunnel`, use the `exp://…exp.direct` address Expo prints, followed by `/--`. Links sent before a change keep the old address. Production will use universal links on the app's domain (proposal M-19), which need our own build.

## Alternative: the Android emulator on the Mac

No phone needed. Android Studio and the "Pixel 3a API 34" emulator are already installed.

1. In `mobile/.env.local`, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` (`10.0.2.2` is how the emulator reaches the Mac).
2. Start the API normally (`cd api && bin/rails server`; `-b 0.0.0.0` isn't needed for the emulator).
3. Run `cd mobile && nvm use && npx expo start --clear`, then press `a`. Expo opens the emulator and installs Expo Go in it.

The iOS Simulator won't work until Xcode is reinstalled: Expo SDK 57 needs Xcode 26.4 or newer.

## Checks

```bash
npm run lint         # ESLint (Expo rules, no hard-coded colors, no AsyncStorage, fetch only in src/api) + Prettier
npm run typecheck    # tsc --noEmit
npm test             # Jest + React Native Testing Library
npm run deps:check   # package versions match Expo SDK 57
npm run ci           # all of the above
npm run format       # fix formatting
```

CI runs the same checks, plus an Android bundle, on every change to `mobile/` (`.github/workflows/mobile.yml`).

## Where things live

| Path                     | Contents                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/`               | Routes (Expo Router): one file per screen. `(tabs)/` holds the 5 tabs. Only route files go here, never tests.                                                                        |
| `src/screens/`           | Screen bodies, grouped by area. `PlaceholderScreen` is used for tabs whose feature isn't built yet.                                                                                  |
| `src/components/`        | Components named after the design system: `TabBar`, `Button`, `Notification`, `Skeleton`, `Icon`…                                                                                    |
| `src/navigation/tabs.ts` | The 5 tabs: order, icons, module colors                                                                                                                                              |
| `src/api/`               | The typed API client (`api().request`, `api().health`), types from `docs/api/*.md`, React Query setup                                                                                |
| `src/auth/`              | Token storage (expo-secure-store only), session provider, 401 handling                                                                                                               |
| `src/i18n/`              | `fr.json` (default, "tu") and `en.json`                                                                                                                                              |
| `src/hooks/`             | `useReduceMotion` and other shared hooks                                                                                                                                             |
| `src/theme/tokens.js`    | Design system section 15 values: **the only file allowed to contain colors**. `tailwind.config.js` and `app.config.ts` read it. A test checks it against the design system document. |
| `src/test/`              | Jest helpers, fixtures copied from the API contract, the app shell test                                                                                                              |
| `assets/brand/`          | App icon, adaptive icon layers and splash exported from `docs/design/brand/ripple/`                                                                                                  |

## Styling rules

- Style with Tailwind classes from the design tokens: `bg-shell`, `text-ink-2`, `bg-green text-ink` (Primary), `rounded-lg`, `px-lg`, `text-h1`… Tailwind's default color palette doesn't exist (design system v1.4.1).
- Never type a color value in a component. When code needs a raw value (icon color, spinner), use `colorValue('green-dark')` from `src/theme/colors.ts`. ESLint fails on any `#hex`, `rgb(` or `rgba(` outside `tokens.js`.
- Icons: `<Icon icon={House} color="ink-2" />`. Stroke 1.8 is applied for you.
- Every tappable element is at least 44 px tall (`MIN_TOUCH_TARGET`), has an accessibility role and a label.
- Animations respect `useReduceMotion()`.

## Brand assets

The icon and splash PNGs are generated from the SVGs in `docs/design/brand/ripple/`. Don't edit them by hand. After the designer regenerates the SVGs, run:

```bash
npm run export-brand-assets   # needs rsvg-convert: brew install librsvg
```

## Package notes

- `react-dom` is pinned to the React version in `overrides` (`package.json`). Expo Router pulls it in for web support we don't use; without the pin, npm picks a newer `react-dom` that conflicts with React 19.2.3.
- Add packages with `npx expo install <package>` so versions match the SDK, and only after the PM approves them.
