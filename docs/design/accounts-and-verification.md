# Design: Accounts and verification (v1)

> Feature slug: `accounts-and-verification` · Author: designer · Date: 2026-10-02 · **Status: Approved by the PM on 2026-10-02**
>
> Spec: [`docs/specs/accounts-and-verification.md`](../specs/accounts-and-verification.md) (approved by the PM on 2026-10-02) · Design system: [`docs/SPARKCIRCLES_Design_System_EN.md`](../SPARKCIRCLES_Design_System_EN.md) **v1.4**
>
> Mockups in `docs/design/mockups/`:
> - Mobile (390px): `accounts-and-verification-signup.html`, `-check-inbox.html`, `-account.html`, `-profile-preview.html` (badge sheet open), `-verify-gate.html`, `-verify-capture.html`, `-verify-status.html`, `-close-account.html`
> - Web admin (1280px): `accounts-and-verification-admin-queue.html`, `-admin-review.html`
>
> Each mockup shows one state; a caption above the frame names the screen, state and ACs.

### Revision 2 (PM decisions of 2026-10-02)
- Palette moved to design system v1.3: **green Primary CTA**, **green "Verified ✓"**, green success icons, Home = lavender, Events = green, new **Error** color and **Destructive** button, neutral "Not verified" badge, Ink 3 control borders, checkbox / radio / field specs.
- **Admin is a separate web back office**: admin screens removed from the mobile app and redesigned as a minimal desktop web admin (section 2, "Web admin").
- **Change my email** flow added (A3b).
- Rejection reasons approved as proposed (AD3).
- **Primary button softened** (PM feedback): green **Base** `#A5E07F` fill with **Ink** text; pressed = 1.5px green-dark inset border; disabled = Shell fill, dashed Ink 3 border, Ink 3 text. Green-dark stays for links, Ghost/Secondary, focus, check icons and "Verified ✓" text.
- **Recommendations stay lavender**: confirmed by the PM (not used on these screens).
- "My account" entry is the initials avatar on Today (photo upload goes to the backlog via the PO).

## 0. Design principles for this feature

- **Neutral base, green CTA.** Account and auth screens are cross-module screens (design system v1.3, section 1): Shell background, Surface cards, Ink text, green **Primary** button for the single main action, no module accent.
- **Accents only carry status meaning**: green = confirmed, success and "Verified ✓"; yellow = pending or something to do; neutral grey = "Not verified"; **Error** = real errors, field errors and destructive actions only, always with an icon + text.
- **Just-in-time verification.** Nothing in sign-up mentions identity documents. Verification is offered when a parent tries to host, and is always reachable from "My account".
- **The app never reveals whether an email is registered** (AC-1.3, AC-3.2, AC-4.1, and the email change): the copy for those screens is identical whatever happens on the server.
- **Trust before convenience (P8).** The badge ("Verified ✓" or "Not verified") always sits next to the person's name, before any call to action.
- **No "please", no "successfully".** Sentence case. Copy below is English; French copy is needed for launch (allow +20% length on every label; buttons wrap to two lines rather than truncate). **French uses "tu"** (design system v1.4, voice and tone), and stays warm but serious in verification, rejection, closure and safety messages (e.g. "Vérifie ton identité pour organiser", "Ton compte sera supprimé le 1 nov. 2026"). English uses "you".

## 1. User paths

Tap counts exclude typing. Mental-load justification for each tap is given in brackets.

### P1 — Sign up and confirm email (US-1, US-2, US-5) · 3 taps + email link

1. **Welcome** → "Create my account" (1) [entry choice: create vs log in].
2. **Sign up**: type first name, last name, email, password; tick "I'm 18 or older" and "I accept the terms and privacy policy" (mandatory, unticked by default: AC-5.1); the marketing box is optional. "Create my account" (2).
3. **Check your inbox** → "Open my mail app" (3, optional shortcut).
4. Tap the link in the email → the app opens **logged in on Today** with the success checkmark and a toast. No extra screen to dismiss.

Target: under 2 minutes (spec metric 1). Only 6 inputs (AC-1.6).

### P2 — Log in (US-3) · 1 tap after typing
Welcome → "Log in" → email + password → "Log in". Parents stay logged in for 30 days of activity (AC-3.4), so Welcome is skipped on reopen.

### P3 — Reset password (US-4) · 3 taps + email link
Log in → "Forgot your password?" (1) → email → "Send me a link" (2) → email link → **New password** → "Save my new password" (3) → logged in.

### P4 — Verify identity to host (US-7) · 9 to 11 taps, done at most every 2 years

Entry A (just in time): Events → "Create an event" (1) → **Verify to host** → "Verify my identity" (2).
Entry B (proactive): Today → initials avatar (1) → **My account** → verification card "Verify my identity" (2).

3. **Which document do you have?**: tap your document type (3) [one tap picks the document and starts; it tells the app whether to ask for a back side].
4. **Front photo**: shutter (4) → "Use this photo" (5) [the check step prevents blurry photos, the #1 cause of a 48-hour rejection loop].
5. **Back photo** (two-sided documents only): shutter (6) → "Use this photo" (7).
6. **Selfie**: shutter (8) → "Use this photo" (9).
7. **Date of birth and check**: native date picker → "Send for review" (10–11).
8. **Verification sent** ("Pending", "Usually within 48 hours").

Passport: 9 taps. ID card: 11 taps. Above the usual budget, but it is a legal identity check done at most every 2 years; every step is one obvious action with a step counter.

### P5 — Understand someone's badge (US-8) · 1 tap
Tap "Verified ✓" or "Not verified" next to any name (1) → **Badge explanation** sheet.

### P6 — See how others see me (US-6) · 2 taps
Today → avatar (1) → "How others see me" (2).

### P7 — Change my email · 4 taps + email link
Today → avatar (1) → "Edit my profile" (2) → "Change" next to the email (3) → new email + password → "Send a confirmation link" (4) → tap the link sent to the new address.

### P8 — Close my account (US-11) · 3 taps · cancel: 1 tap after login
Today → avatar (1) → "Close my account" (2) → read, type password → destructive "Close my account" (3). Cancel within 30 days: log in → "Keep my account" (1).

### P9 — Get a copy of my data (US-12) · 3 taps, then 1 to download
Today → avatar (1) → "Get a copy of my data" (2) → "Request my copy" (3). When ready: notification or email → "Download my data" (1).

### P10 — Admin reviews a verification (US-9, web back office) · 2 clicks to approve, 4 to reject
Log in on the web admin + second-factor code → **Verification queue** (oldest first) → open the oldest (1) → check document, selfie, name, date of birth; type the document's expiry date → "Approve" (2). Reject: "Not accepted" (2) → choose a reason (3) → optional note → "Send" (4). Back to the queue with a toast.

## 2. Screen list

Screens without a mockup reuse the layout and components of the mockup named in brackets.

### Auth (mobile, not logged in)

| # | Screen | Purpose | Single primary action | Mockup |
|---|---|---|---|---|
| S1 | Welcome | Create an account or log in | "Create my account" (Ghost "Log in") | (signup) |
| S2 | Sign up | Create an account with the minimum data | "Create my account" | `signup` |
| S3 | Check your inbox | After sign-up; the only screen an unconfirmed account can see (AC-2.3) | "Open my mail app" (Ghost "Send the link again") | `check-inbox` |
| S4 | Link expired | Expired or used confirmation, reset or email-change link (AC-2.2, AC-4.3) | "Send me a new link" | (check-inbox) |
| S5 | Log in | Email + password | "Log in" | (signup) |
| S6 | Forgot password | Ask for a reset link | "Send me a link" | (signup) |
| S7 | Link sent | Neutral confirmation (AC-4.1) | "Open my mail app" | (check-inbox) |
| S8 | New password | Set a new password from the link | "Save my new password" | (signup) |
| S9 | Terms updated | New terms version must be accepted (AC-5.5) | "Accept and continue" | (close-account) |
| S10 | Closure in progress | Login during the 30-day grace period (AC-11.3) | "Keep my account" | (check-inbox) |

### My account (mobile, logged-in parent)

| # | Screen | Purpose | Single primary action | Mockup |
|---|---|---|---|---|
| A1 | My account | Hub: profile, verification status, privacy, security, data, closure | Depends on verification status; none when verified | `account` |
| A2 | How others see me | Exact preview of the public profile (AC-6.3) | "Edit my profile" | `profile-preview` |
| A3 | Edit profile | First name, last name, city or neighborhood shown, email row | "Save" | (signup) |
| A3b | Change my email | New email + password, confirmation link | "Send a confirmation link" | (signup) |
| A4 | Privacy and messages | Marketing choice, accepted terms versions | none (saves immediately: AC-5.4) | (account) |
| A5 | Password and devices | Change password, log out everywhere | "Change my password" | (signup) |
| A6 | Copy of my data | Request and download the data file | "Request my copy" / "Download my data" | (account) |
| A7 | Close my account | Explain consequences, confirm with password | Destructive "Close my account" | `close-account` |
| A8 | Account closed | Final screen before logout | "OK" | (check-inbox) |
| B1 | Badge explanation | Bottom sheet: what "Verified" means and doesn't mean (AC-8.3) | "Got it" | `profile-preview` |

### Verification (mobile, parent)

| # | Screen | Purpose | Single primary action | Mockup |
|---|---|---|---|---|
| V0 | Verify to host | Gate when a non-verified parent creates an event (AC-7.1) | "Verify my identity" | `verify-gate` |
| V1 | Which document do you have? | Accepted documents; choose type | Tap a document type | (verify-gate) |
| V2 | Document photo | Capture front, then back if two-sided | Shutter, then "Use this photo" | `verify-capture` |
| V3 | Selfie | Capture face | Shutter, then "Use this photo" | (verify-capture) |
| V4 | Date of birth and check | Date of birth + summary | "Send for review" | (verify-capture) |
| V5 | Verification status | Pending / verified / not accepted / expired | Depends on status | `verify-status` |

### Web admin (separate back office, desktop)

| # | Screen | Purpose | Single primary action | Mockup |
|---|---|---|---|---|
| W0 | Admin log in + code | Email, password, then 6-digit code (AC-9.5) | "Log in" / "Confirm" | (admin-queue layout, centered 400px card) |
| W1 | Verification queue | Pending verifications, oldest first, waiting time (AC-9.1, 9.3) | "Review" on the oldest | `admin-queue` |
| W2 | Verification review | Document, selfie, name, date of birth, expiry date; decide (AC-9.2) | "Approve" (Ghost "Not accepted") | `admin-review` |
| W3 | Reason dialog | Pick a rejection reason + optional note | "Send" | (admin-review) |
| W4 | Find a member | Search by email for role changes and revocation (AC-7.9, AC-9.6) | "Search" | (admin-queue) |
| W5 | Member detail | Roles, verification status, "Remove verification", admin role | none (each action confirms in a dialog) | (admin-review) |

The mobile app has **no admin screens** and no admin row in "My account". Admins use the same mobile app as parents for their own parent account.

## 3. Screens, states and copy

Shared rules (design system v1.3):
- **Loading** = skeleton of the screen's exact structure (`rgba(0,0,0,0.08)`, shimmer 0.5 → 1.0, 1.5s). Never a lone spinner on a whole page. Submissions use the button **Loading** state.
- **Error banner** (network/server): **Error notification** (error-light bg, error-dark `alert-circle` icon, title 13px/500 Ink, caption error-dark): "We couldn't reach SparkCircles" / "Check your connection and try again." + Small Secondary "Try again".
- **Field error**: Error-dark border on the input, error text under it (Caption, error-dark, leading `alert-circle` 14px), focus moves to the first field in error, announced with `aria-live="polite"`.
- **Header**: 44px back button + H1 title; optional step counter.
- **Toast**: Surface, `radius-lg`, Level 3, Body Ink with a green-dark `check` (success) or error-dark `alert-circle` (failure), 3 s.
- **Success checkmark** (email confirmed, verification sent, verified): green-dark check draws itself in a green-light circle, 300ms, static under reduced motion.

### S1 Welcome
- Ripple horizontal lockup (design system v1.4, section 19; 40 px tall, replaces the H1 wordmark placeholder), Body Ink 2 "Organize family life with families near you.", 🦄 32px. Primary Large "Create my account", Ghost Large "Log in". Language link "Français" / "English" (Caption-size link, top right).

### S2 Sign up (mockup `signup`) · AC-1.1, 1.2, 1.4, 1.6, 5.1, 5.3
- Fields: "First name", "Last name" (helper "Others only see the first letter."), "Email", "Password" (helper "At least 10 characters. Avoid common passwords." + eye toggle).
- Checkboxes, unticked by default: "I'm 18 or older" (required) · "I accept the [terms of use] and the [privacy policy]" (required; links open the documents in a sheet without losing the form) · "Send me news and ideas from SparkCircles (optional)".
- Primary Large "Create my account". Caption "Already have an account? [Log in]".
- Field errors (Error state):
  - Missing 18+ box: "Tick this box to confirm you're 18 or older. SparkCircles is for adults only."
  - Missing terms box: "Tick this box to accept the terms and privacy policy."
  - Password: "Use at least 10 characters, and avoid common passwords like 'motdepasse123'."
  - Email format: "Check your email address, it looks incomplete."
  - Empty names: "Add your first name." / "Add your last name."
- Success: S3, identical whether the email is new or already used (AC-1.3).

### S3 Check your inbox (mockup `check-inbox`) · AC-1.3, 2.1, 2.3, 2.4
- Mail icon in a 64px Surface circle, H1 "Check your inbox", Body "We've sent a link to **c•••••@gmail.com**. Tap it within 24 hours to confirm your email." Primary "Open my mail app", Ghost "Send the link again". Info card "Can't find it?" / "Look in your spam folder. Unconfirmed accounts are deleted after 7 days." Quiet link "Log out".
- Only reachable screen for an unconfirmed account (AC-2.3). No tab bar.
- Resend: Ghost becomes Disabled + Caption "New link sent. You can ask again in a moment." (wait time set by the developer).
- Success: Today + success checkmark + toast "Email confirmed. Welcome to SparkCircles!"

### S4 Link expired · AC-2.2, AC-4.3
- `clock` icon, H1 "This link has expired", Body "Links work for a limited time and only once. We'll send you a fresh one." Primary "Send me a new link".

### S5 Log in · AC-3.1, 3.2, 3.3
- "Email", "Password" (eye toggle), link "Forgot your password?", Primary "Log in", Caption "New here? [Create my account]".
- Wrong credentials (same for both): Error notification "Email or password doesn't match" / "Check both and try again."
- Locked: Error notification "Too many attempts" / "Try again in 15 minutes, or reset your password." + Small Secondary "Reset my password".

### S6 Forgot password / S7 Link sent · AC-4.1
- S6: H1 "Reset your password", Body "Enter your email and we'll send you a link.", "Email", Primary "Send me a link".
- S7 (always the same): H1 "Check your inbox", Body "If an account exists for this email, we've sent you a link. It works for 1 hour." Primary "Open my mail app".

### S8 New password · AC-4.2
- "New password" (helper as S2). Primary "Save my new password". Caption "You'll be logged out on your other devices." Success: Today + toast "Password changed".

### S9 Terms updated · AC-5.5
- H1 "Our terms have changed", Body "Here's what's new:", Surface card with 2–4 bullets written by the PM, links "Read the full terms" / "Read the privacy policy". Primary "Accept and continue". Ghost "I don't accept" → A7 (closing is the only alternative). Blocks the app until answered.

### S10 Closure in progress · AC-11.3
- H1 "Your account is closing", Body "Your personal data will be erased on **12 Nov 2026**. Until then, you can keep your account as it was." Primary "Keep my account", Ghost "Log out". Success: Today + toast "Welcome back. Your account is active again."

### A1 My account (mockup `account`) · AC-3.5, 6.3, 7.5, 11.1, 12.1
- Entry: initials avatar button (LG 44px, top right of Today).
- Header: avatar LG with initials + H2 "Claire M." + badge + Caption "claire•••@gmail.com".
- **Verification card** by status:

| Status | Badge (owner view) | Card text | Card action |
|---|---|---|---|
| Not verified | `badge-neutral` "Not verified" | H3 "Verify your identity to host events" · Body "Joining events never needs it. About 3 minutes, reviewed within 48 hours." | Primary "Verify my identity" |
| Pending | `badge-yellow` "Pending" | H3 "We're checking your identity" · Body "Usually within 48 hours. We'll let you know." · Caption "Sent on 2 Oct, 14:05" | Ghost "See details" → V5 |
| Verified | `badge-green` "Verified ✓" | H3 "You're verified" · Body "Valid until 2 Oct 2028." | text link "What this means" → B1 |
| Expires soon (≤ 30 days) | `badge-yellow` "Expires soon" | H3 "Your verification ends on 1 Nov" · Body "Verify again with a valid document to keep hosting." | Primary "Verify again" |
| Not accepted | `badge-yellow` "Not accepted" | H3 "We couldn't verify your identity" · Body: the admin's reason, e.g. "The photo is blurry. Take a new one in good light." | Primary "Try again" |
| Expired | `badge-yellow` "Expired" | H3 "Your verification has ended" · Body "Others now see you as not verified. Verify again to host events." | Primary "Verify again" |
| Removed (revoked) | `badge-neutral` "Not verified" | H3 "Your verification was removed" · Body: the admin's reason. | Primary "Verify again" |

- Settings list: "How others see me", "Edit my profile", "Privacy and messages", "Password and devices", "Get a copy of my data".
- Ghost "Log out" (no confirmation, reversible → S1 + toast "You're logged out"), then quiet link "Close my account" at the very bottom.
- Loading: skeleton of header + card + 5 rows.

### A2 How others see me (mockup `profile-preview`) · AC-6.1, 6.3
- Body "This is exactly what other members see." Public profile card: initials avatar, H3 "Claire M.", badge, `map-pin` "Croix-Rousse, Lyon" (or "Neighborhood not shown"). Label "Never shown to others" + `lock` "Full last name, email, date of birth, identity document and selfie." Primary "Edit my profile".

### B1 Badge explanation sheet · AC-8.2, 8.3
- **Verified**: verification icon square (green-light / green-dark `shield-check`), H2 "Identity checked by SparkCircles", Body "We checked an official ID and a selfie of this person.", rows: green-dark `check` "Their name and face match an official ID" · Ink 2 `x` "This is not a criminal record check". Caption "Always trust your own judgment with your children." Primary "Got it".
- **Not verified**: neutral icon square, H2 "Not verified yet", Body "This person hasn't checked their identity with SparkCircles. They can join events open to everyone, but can't host." Primary "Got it". Never says pending, rejected or expired (AC-8.2).

### A3 Edit profile · AC-6.1, 7.8
- Initials avatar (photo upload: backlog), "First name", "Last name", "City or neighborhood shown to others" (helper "Optional. Leave empty to hide it."), "Email" read-only row with Small Ghost "Change" → A3b.
- Primary "Save" → toast "Profile saved".
- **Verified parent changing a name**: sheet H2 "Change your name?", Body "Your Verified badge will be removed. You'll need to verify again before hosting new events." Primary "Change my name", Ghost "Keep my name".

### A3b Change my email (spec addition by the PO)
- H1 "Change your email", Body "We'll send a link to your new address. Your current email keeps working until you confirm." Fields "New email", "Your password". Primary "Send a confirmation link".
- Success (always the same, even if the new address is already used by another account, so registration is never revealed): H1 "Check your new inbox", Body "We've sent a link to **n•••@mail.fr**. Tap it to confirm your new email. We've also told your current address about this change." Primary "Open my mail app".
- Link tapped: My account + toast "Email changed". Expired link: S4.
- Errors: wrong password "This password doesn't match."; same address "This is already your email."; format as S2.
- Pending change visible in A3: Caption under the email row "Waiting for confirmation of n•••@mail.fr" + link "Send the link again".

### A4 Privacy and messages · AC-5.2, 5.4
- Checkbox "Send me news and ideas from SparkCircles", saves immediately (toast "Saved"), Caption "Changed on 2 Oct 2026."
- Rows "Terms of use" / "Privacy policy" with Caption "Accepted on 2 Oct 2026, version 1.0".

### A5 Password and devices · AC-3.6, 4.4
- "Current password", "New password", Primary "Change my password", Caption "You'll be logged out on your other devices." Wrong current password: field error "Your current password doesn't match."
- Ghost "Log out of all devices" → sheet H2 "Log out everywhere?", Body "You'll need to log in again on every device, including this one." Primary "Log out everywhere", Ghost "Cancel".

### A6 Copy of my data · AC-12.1–12.3
- Not requested: H1 "Get a copy of your data", Body "You'll get a file with your account, profile, consents, history and verification outcome. Usually within 48 hours, 30 days at most." Primary "Request my copy".
- Requested: `badge-yellow` "Pending", Body "Requested on 2 Oct. We'll send you a notification and an email." Primary Disabled.
- Ready: Confirmed notification "Your data is ready" / "Download link works until 9 Oct." Primary "Download my data" (login required: AC-12.2).
- Link expired: Body "The download link has expired." Primary "Request a new copy".

### A7 Close my account (mockup `close-account`) · AC-11.1, 11.9
- H1 "Close your account", Body "Here's what happens:", card with 4 rows: "Your profile disappears for others right away." / "You're logged out on all your devices." / "Your personal data is erased on **1 Nov 2026**." / "Until then, log in to keep your account. After that, nothing can be recovered."
- Hosting upcoming events: Reminder notification "You host 2 upcoming events" / "They'll be cancelled and families will be told."
- "Your password". **Destructive** Large "Close my account" (leading `log-out` icon, Disabled until a password is typed). Ghost Large "Keep my account".
- Wrong password: field error "This password doesn't match."

### A8 Account closed · AC-11.2
- H1 "Your account is closed", Body "We've sent you an email. Your data will be erased on 1 Nov 2026. Changed your mind? Log in before then." Primary "OK" → S1.

### V0 Verify to host (mockup `verify-gate`) · AC-7.1, 7.2, 7.5
- Verification icon (green-light / green-dark `shield-check`, 56px), H1 "Verify your identity to host", Body "Verified hosts keep children safe. Joining events never needs it." Card "What you'll need": valid passport, ID card, driving licence or residence permit · a selfie, taken now · about 3 minutes, reviewed within 48 hours. `lock` Caption "Your photos are only seen by our team and erased within 30 days of the decision." Primary "Verify my identity", Ghost "Not now".
- Pending variant: `badge-yellow` "Pending", H1 "We're checking your identity", Body "Usually within 48 hours. You'll be able to host as soon as you're verified." Primary "OK".

### V1 Which document do you have? · AC-7.3, 7.4
- Caption "Step 1 of 4", H1 "Which document do you have?", settings-list rows (56px, `id-card` icon, chevron): "Passport" (Caption "Photo page"), "National ID card" ("Front and back"), "Driving licence" ("Front and back"), "Residence permit" ("Titre de séjour, front and back"), "Other government residence card" ("Front and back"). Caption "Your document must not be expired."

### V2 Document photo (mockup `verify-capture`) · AC-7.3, 7.4
- Caption "Step 2 of 4", H2 "Front of your ID card", Body "Place it flat, inside the frame.", capture frame (Surface card, dashed 1.5px Ink 3 guide, `radius-lg`), tips as Tags "Good light", "All 4 corners visible", "No glare". Shutter (green Base fill, Ink camera icon). Link "Choose from my photos".
- Check step: photo replaces the frame, H2 "Is everything readable?", Primary "Use this photo", Ghost "Take it again".
- Expired document detected: field error "This document has expired. Use a valid one." + Ghost "Choose another document".
- Camera denied: Reminder notification "SparkCircles needs your camera to take the photo" + Small Secondary "Open settings".

### V3 Selfie
- Caption "Step 3 of 4", H2 "Now a selfie", oval guide, tips "Face the light", "No glasses or hat", "Neutral expression". Same shutter and check step.

### V4 Date of birth and check · AC-7.3
- Caption "Step 4 of 4", H2 "Last step", "Date of birth" (native picker), summary rows with thumbnails and green-dark `check` icons: "ID card, front", "ID card, back", "Selfie" (each with Small Ghost "Retake"). Privacy caption as V0. Primary "Send for review". Loading Caption "Sending your photos securely…". Upload error: Error notification "Your photos didn't send" / "Check your connection and try again." (photos kept on the device).

### V5 Verification status (mockup `verify-status`, "Pending") · AC-7.3, 7.5–7.7, 7.11–7.13
- **Pending (mockup)**: success checkmark, `badge-yellow` "Pending", H1 "Verification sent", Body "Our team checks every request by hand. We'll send you a notification and an email.", data display "48 h" / Caption "Usual review time", timeline (Sent · Review by our team · Decision). Primary "Back to my account".
- **Verified**: success checkmark, `badge-green` "Verified ✓", H1 "You're verified", Body "You can host events now.", data display "2 Oct 2028" / "Valid until". Primary "Create an event" (from the gate) or "Back to my account".
- **Not accepted**: `badge-yellow` "Not accepted", H1 "Let's try again", Reminder notification with the reason and what to do (e.g. "The photo is blurry" / "Take a new one in good light, with all 4 corners visible."). Primary "Try again".
- **Expires soon / Expired**: as in A1, Primary "Verify again".
- Notifications (in-app + email): approved → Confirmed "You're verified" / "You can host events now."; rejected → Reminder "Your verification needs another try" / short reason; 30 and 7 days before expiry → Reminder "Your verification ends in 30 days" (or 7) / "Verify again to keep hosting."; expired → Reminder "Your verification has ended" / "Verify again to host events."; revoked → Reminder "Your verification was removed" / "Open your account to see why."

### Badge placement in other modules · AC-8.1, 8.2, 8.4
- Next to every name near a call to action (profile, event host, participants, community members): `badge-green` "Verified ✓" or `badge-neutral` "Not verified", tappable → B1. Dense lists: 16px `shield-check` icon variant (design system section 6).
- Former members (AC-11.7): neutral "?" avatar, "Former member", no badge.
- Restricted action (AC-8.4): sheet H2 "This event is for verified families", Body "Verify your identity to take part. It takes about 3 minutes.", Primary "Verify my identity", Ghost "Not now".

### W0 Web admin log in · AC-9.4, 9.5
- Centered 400px Surface card on Shell: wordmark, H2 "Admin", "Email", "Password", Primary "Log in"; then H2 "Confirm it's you", Body "Enter the 6-digit code from your authenticator app.", one numeric input (`autocomplete="one-time-code"`), Primary "Confirm". Wrong code: field error "This code doesn't work. Codes change every 30 seconds, try the new one." Non-admin account: same neutral "Email or password doesn't match" (never reveals the admin area).

### W1 Verification queue (mockup `admin-queue`) · AC-9.1, 9.3
- Top bar (Surface, 64px): wordmark, nav links "Verifications" (active style proposed in gap W-G3) and "Members", admin name + quiet link "Log out".
- Content max 1040px centered. H1 "Verifications", Body "4 waiting · oldest first". Oldest card: Label "Oldest waiting", H3 name, Caption document type and sent time, data display "31 h" + Caption "waiting", `badge-yellow` "Over 24 h", Primary "Review".
- List (Surface card, 56px rows, columns): Member · Document · Sent · Waiting · action link "Review". Own verification row: Caption "Your own verification. Another admin reviews it.", no action (AC-9.3).
- Empty: 🦄, H3 "All caught up", Body "No verification is waiting. New ones appear here, oldest first." Ghost "Find a member".
- Error: Error notification. Loading: skeleton rows.

### W2 Verification review (mockup `admin-review`) · AC-9.2, 10.4, 7.10, 7.11
- Breadcrumb back link "← Verifications". H1 "Thomas R.", `lock` Caption "Your access is recorded: verification review."
- Two columns: **left (wide)** large image tiles "Front", "Back", "Selfie" (click to zoom, never cached). **Right (360px)** card: "Name on the account" Thomas Renard, "Date of birth" 14 Mar 1988, "Document" ID card; field "Document expiry date" (required) + Caption "Verification will be valid until 2 Oct 2028 (2 years, before the document expires)."; Primary "Approve" (Disabled until the date is set), Ghost "Not accepted".
- Expired document date: field error "This document has expired. Choose 'Not accepted' with the reason 'Document expired'."
- Success: back to W1, toast "Approved. Thomas R. is verified."

### W3 Reason dialog · AC-7.7, 9.2 (approved by the PM)
- Modal (Surface, `radius-xl`, Level 2, Scrim, 480px). H2 "Why isn't it accepted?", radio list (reason + the message the parent sees as Caption):
  - "Photo blurry or too dark" → "The photo is blurry. Take a new one in good light."
  - "Document cut off" → "Part of the document is missing. Show all 4 corners."
  - "Document expired" → "This document has expired. Use a valid one."
  - "Document not accepted" → "We accept passports, ID cards, driving licences and residence permits."
  - "Selfie doesn't match" → "We couldn't match your selfie with your document. Take a new selfie facing the light."
  - "Name doesn't match the account" → "The name on the document doesn't match your account. Update your name or use another document."
- "Note for the parent (optional)". Primary "Send", Ghost "Cancel". Toast "Sent to Thomas R."

### W4 Find a member / W5 Member detail · AC-7.9, 9.6, 10.4
- W4: "Email" + Primary "Search". Before results, a dialog asks the reason (radio: "User request", "Safety report", "Verification follow-up") for the audit log.
- W5: name, email, roles, verification status and expiry. Actions in dialogs: **Destructive** "Remove verification" (reason radio + note, AC-7.9); Ghost "Give admin role" / "Remove admin role" (AC-9.6, hidden on the admin's own account).

## 4. Components and tokens used (design system v1.3)

| Component | Where | Tokens |
|---|---|---|
| Shell / Surface | all screens | `#F8F7F4` / `#FFFFFF`, card border 0.5px `rgba(0,0,0,0.08)`, `radius-lg` 16px, padding 16px, Level 1 |
| Primary Large | main action | bg green Base `#A5E07F`, text Ink `#1A1A1A`, 15px/500, 14px 28px, `radius-pill`, 48px · hover opacity 0.9 · pressed scale 0.97 + 1.5px green-dark inset border · disabled Shell `#F8F7F4` fill, 1.5px dashed Ink 3 border, Ink 3 text |
| Ghost Large | second action | border 1.5px `#2F7A1F`, text `#2F7A1F` |
| Secondary Small | banner actions | bg `#E6F7DD`, text `#2F7A1F`, 12px/500, 7px 14px, 44px |
| Destructive Large | "Close my account", "Remove verification" | bg error-dark `#B42318`, white, leading line icon; disabled uses the Primary disabled style (Shell, dashed Ink 3 border, Ink 3 text) + caption "Enter your password to continue" |
| Text links | "Log in", "Forgot your password?" | Body 14px/500 green-dark; quiet links Body Ink 2 underlined |
| Inputs | all fields | border 1.5px Ink 3 `#6E6E6E`, `radius-md`, 10px 14px, 44px; focus `#2F7A1F`; error `#B42318`; label Body Ink 2; helper Caption Ink 3; error Caption error-dark + icon |
| Checkbox / radio | consent, marketing, reasons | 24px box `radius-sm`, 1.5px Ink 3, checked green-dark + white check; radio 22px, selected green-dark dot |
| Badges | status | `badge-green` Verified ✓; `badge-neutral` Not verified; `badge-yellow` Pending / Expires soon / Not accepted / Expired / Over 24 h |
| Notifications | banners, decisions, reminders | Error, Reminder, Confirmed levels; `radius-lg`, 12px 16px |
| Toast | confirmations | Surface, `radius-lg`, Level 3 |
| Bottom sheet / dialog | B1, confirmations, W3 | Surface, `radius-xl`, Level 2, Scrim `rgba(26,26,26,0.4)` |
| Avatars | headers, profile | LG 44px initials, rotating Light/Dark pairs |
| Icon squares | rows, cards | neutral (Shell + Ink 2); verification (green-light + green-dark) |
| Line icons | everywhere | Lucide, stroke 1.8 |
| Typography | — | H1 28/500, H2 20/500, H3 16/500, Body 14/400, Caption 12/400, Label 11/500, Data display 32/500 |
| Spacing | — | side padding 16px, sections 24px, rows 12px, bottom 48px |

## 5. Accessibility notes

| Pair | Ratio | Use |
|---|---|---|
| Ink on green Base `#A5E07F` | 11.25 | Primary buttons, shutter icon |
| Ink on green Base at 90% (hover) over Surface / Shell | 11.74 / 11.63 | Primary hover |
| Green-dark border against green Base | 3.46 | Primary pressed border (≥ 3:1) |
| Ink 3 on Shell | 4.76 | Disabled Primary / Destructive label and dashed border |
| Green Base on Surface / Shell | 1.55 / 1.44 | fill only, never text, icon, border or focus |
| White on green-dark `#2F7A1F` | 5.35 | checked checkbox icon |
| Green-dark on Surface / Shell | 5.35 / 4.99 | Ghost buttons, links, success icons |
| Green-dark on green-light `#E6F7DD` | 4.77 | "Verified ✓", Confirmed notification, Secondary buttons |
| White on error-dark `#B42318` | 6.57 | Destructive buttons |
| Error-dark on error-light `#FDECEC` | 5.76 | Error notification |
| Error-dark on Surface / Shell | 6.57 / 6.14 | Field error text and icon |
| Ink on error base `#F4A6A6` | 8.99 | (reserved, not used here) |
| Ink 3 `#6E6E6E` on Surface | 5.1 | input/checkbox/radio borders (≥ 3:1), captions |
| Ink 2 `#4A4A4A` on Shell | 8.27 | "Not verified" badge, labels |
| Yellow-dark on yellow-light | 5.12 | Pending, reminders |
| Ink on Surface / Shell | 17.4 / 16.25 | titles, names, data |

- Touch targets ≥ 44px (checkbox rows full-width; badge tap areas padded; shutter 64px). Web admin: click targets ≥ 44px too.
- Every field has a visible label; icon-only controls have `aria-label` ("Back", "Show password", "Take the photo", "Close").
- Errors: icon + text, never color alone; `aria-describedby`, `aria-live="polite"`, focus to first error. Destructive button carries an icon and a clear label.
- Badges expose meaning (`aria-label="Verified, identity checked by SparkCircles. Opens an explanation."`).
- Reduced motion: checkmark and toasts appear without animation; shimmer becomes static.
- Capture also offers "Choose from my photos"; steps announced ("Step 2 of 4, front of your ID card").
- Email partly masked on screen; passwords hidden by default. `lang` set per language.
- Web admin: full keyboard navigation and visible focus (focus ring style is a web gap, W-G2).

## 6. Traceability

| AC | Screens |
|---|---|
| AC-1.1, 1.2, 1.4, 1.6 | S2 |
| AC-1.3 | S2 → S3 (identical result) |
| AC-1.5, 1.7 | backend; admin role managed in W5 |
| AC-2.1 | S3 → Today + toast |
| AC-2.2 | S4 |
| AC-2.3 | S3 |
| AC-2.4 | S3 caption |
| AC-3.1, 3.2, 3.3 | S5 |
| AC-3.4 | backend; S1 skipped on reopen |
| AC-3.5 | A1 "Log out" |
| AC-3.6 | A5 sheet |
| AC-4.1 | S6, S7 |
| AC-4.2 | S8 |
| AC-4.3 | S4 |
| AC-4.4 | A5 |
| AC-5.1, 5.3 | S2 |
| AC-5.2, 5.4 | A4 |
| AC-5.5 | S9 |
| AC-6.1, 6.2, 6.3 | A2, A3 |
| AC-6.4 | backend |
| Email change (spec addition) | A3, A3b, S4 |
| AC-7.1 | V0 |
| AC-7.2 | V0, B1 copy; no prompts elsewhere |
| AC-7.3 | V1–V4, V5 |
| AC-7.4 | V1, V2, W2, W3 |
| AC-7.5 | V0 pending, A1, V5 |
| AC-7.6 | V5 verified, notification, W2 |
| AC-7.7 | V5 not accepted, A1, W3 |
| AC-7.8 | A3 name-change sheet |
| AC-7.9 | W5, A1 "Removed", notification |
| AC-7.10 | V0/V4 caption; backend |
| AC-7.11 | A1 "Valid until", V5, W2 expiry field |
| AC-7.12 | A1 "Expires soon", reminders |
| AC-7.13 | A1 "Expired", notification, B1 |
| AC-7.14, 8.5 | backend |
| AC-8.1 | badge placement, A2 |
| AC-8.2 | `badge-neutral`, B1 |
| AC-8.3 | B1 |
| AC-8.4 | restricted-action sheet |
| AC-9.1, 9.3 | W1 |
| AC-9.2 | W2, W3 |
| AC-9.4 | W0 (neutral refusal), no admin UI in the mobile app; backend |
| AC-9.5 | W0 |
| AC-9.6 | W5 |
| AC-10.4 | W2 audit notice, W4 reason dialog |
| AC-10.1–10.3, 10.5–10.7 | backend; no sensitive data in URLs |
| AC-11.1, 11.9 | A7 |
| AC-11.2 | A8 |
| AC-11.3 | S10 |
| AC-11.4–11.6, 11.8 | backend |
| AC-11.7 | "Former member" rule |
| AC-12.1–12.3 | A6 |

## 7. Design system gaps

Resolved in v1.3 (PM decisions of 2026-10-02): G1 cross-module screens, G2 neutral badge, G2b verified badge (green), G3 form controls, G4 error color, G5 destructive button, G6 account avatar entry, G7 header, G8 toast, G9 wordmark, G10 language switch, G11 success checkmark, G12 icon squares, G13 capture frame / step counter / timeline, G15 scrim, G14 admin = web back office.

**Remaining gaps (web admin only)**, not added to the design system, to decide when the back office grows:
- **W-G1 Desktop layout**: max content width (mockups use 1040px centered), grid, breakpoints. Mockups are 1280px wide.
- **W-G2 Keyboard focus ring** style (mockups: 2px green-dark outline, 2px offset — proposal).
- **W-G3 Top navigation**: active link style (mockups: Ink text + Body 500 weight + green-dark 2px underline — proposal); no side navigation yet.
- **W-G4 Data table**: column headers (Label style used), row height 56px, sorting.
- **W-G5 Image zoom viewer** for documents and selfies (full-screen, zoom, rotate).
- **W-G6 Hover states** for rows and links (buttons already have one).

**Other notes for the PM**
- The "Today" dashboard mockup needs a refresh for the v1.3/v1.4 palette, the account avatar and the Ripple logo.
- Q2 (admin second factor type) remains with the developer: the design assumes a 6-digit authenticator app code.


## 8. Addendum — W4/W5: "This wasn't me" reports (AC-13.7, AC-13.8, AC-13.10) · **approved by the PM on 2026-10-02**, including "Close without restoring"

Review of the screens the developer added (`api/app/views/admin/members/index.html.erb`, `show.html.erb`). The structure is right: a reports list on W4, a report card with "Restore previous email" on W5, existing components and tokens. The changes below make the action safe and let the admin see at a glance what happened and what to do.

### W4 Find a member: reports first
- Move the reports block **above** the search form: it is the only part of the page that asks the admin to act.
- Heading: H2 "This wasn't me" reports + `badge-yellow` with the count ("2 open"). Caption under it: "These accounts are locked until you act. Oldest first."
- Table columns: **Member** (H3 weight, display name) · **Email changed** (date + time, e.g. "2 Oct 2026, 09:14") · **Reported** (date + time) · **Waiting** (H3, e.g. "6 h", `badge-yellow` "Over 24 h" after 24 hours) · action link **"Review"** (same word as the verification queue; replaces "Open"). Keep oldest first.
- Empty state: Caption "No report is waiting. Reports appear here as soon as a member tells us an email change wasn't them." (no button).
- Top navigation: when reports are open, show the count next to "Members" (`badge-yellow` "2", `aria-label="2 open reports"`) so admins see it from any page.

### W5 Member detail: report card on top
- When the member has an open report, show it **first**, directly under the H1 and the audit caption, before the member card.
- Next to the H1: `badge-yellow` "Locked" (with `lock` icon) while `security_locked`; nothing when not locked. Remove the plain-text "Security" row from the member card (the badge replaces it).
- **Open report card** (Surface card, `radius-lg`; title row H3 "This wasn't me" report + `badge-yellow` "Open"):
  - Rows (dt Ink 2 / dd Ink 500): "Email changed" 2 Oct 2026, 09:14 · "Previous email" claire.m@… · "New email" x@… · "Reported" 3 Oct 2026, 18:02 (6 h ago).
  - Body: "The member says they didn't change their email. Their account is locked and logged out everywhere."
  - Caption "Before restoring: check that the new address isn't one the member uses, for example by replying to the report from the previous address."
  - Primary "Restore previous email" (it is the protective, expected action, so Primary and not Destructive).
- **Restore confirmation** (required): modal dialog, same pattern as "Remove this verification?" (Surface, `radius-xl`, Level 2, Scrim, 480px):
  - H2 "Restore the previous email?"
  - Body: "**claire.m@…** becomes the login email again. We'll send a password reset link to it, the account unlocks, and **x@…** no longer works for this account."
  - Primary "Restore and send the link" · Ghost "Cancel". Focus moves to the dialog title on open and back to the button on cancel; Escape cancels.
- **Success**: toast/notification Confirmed "Email restored. A password reset link was sent to claire.m@…". The card stays, in its resolved state.
- **Resolved card** (after restore; also shown for past reports, newest first, collapsed under "Past reports" if more than one): `badge-green` "Restored ✓", Caption "Restored on 3 Oct 2026, 18:20 by Claire M. Reset link sent to claire.m@…". No action.
- **Error** (previous email now used by another account): Error notification (error-light, `alert-circle`) title "This email can't be restored" / caption "Another account uses it now. Contact the member through the report and decide the next step with the team." The card stays open.
- **No report**: no card; nothing else changes on W5.

### Copy and tokens notes
- Sentence case everywhere; no "please" / "successfully" (current copy already follows this).
- Badges must use the badge spec: `padding: 4px 10px`, `11px/500` (current CSS uses 2px 10px, 12px).
- Brand in the admin top bar and `<title>`: "SparkCircles" (design system v1.4), ideally the Ripple horizontal lockup at 28 px.

### Resolved: close without restoring (spec AC-13.10, approved by the PM on 2026-10-02)
- **False report**: if the member did make the change (or reported by mistake), there is no way to close the report without restoring the old email, so the account stays locked. Proposal: a Ghost "Close without restoring" on the open card, with its own confirmation ("The account keeps x@…, unlocks, and the member sets a new password through a link sent to x@…") and a required note for the audit log. Spec line added as AC-13.10.
