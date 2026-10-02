# SparkCircles backlog

> Owner: po · Last updated: 2026-10-02 · Items move out of here when they get their own spec in `docs/specs/<slug>.md`.
>
> Sources: "PM #n" refers to the PM's answers to the open questions of the `accounts-and-verification` draft v1. "Spec" refers to [`specs/accounts-and-verification.md`](specs/accounts-and-verification.md).

## Must

| # | Title | Why | Source | Future spec slug |
|---|---|---|---|---|
| 1 | Event creation with "verified users only" option | Hosting needs a verified parent; the host chooses at setup whether the event is open to all or verified users only, using the rule of AC-8.4. This is the first feature that uses verification, and it addresses pain point #1. | PM #7, spec AC-7.1 and AC-8.4 | `event-creation` |
| 2 | Report and block a member | Verification alone doesn't stop a verified person from behaving badly; families need a way to raise a safety concern that leads to revocation (AC-7.9). | Spec, risks | `report-and-block` |
| 3 | Family profile and children data | Children's first names, ages and needs are the most sensitive data in the app and need their own visibility and encryption rules. | Spec, out of scope | `family-profile` |
| 4 | GDPR launch prerequisites (not an app feature) | DPIA, privacy policy, terms, record of processing, retention register, processor agreements, breach procedure: required before public launch. | Spec, GDPR risks | n/a (legal track, PM + GDPR advisor) |

## Should

| # | Title | Why | Source | Future spec slug |
|---|---|---|---|---|
| 5 | Service-provider accounts and business verification | The Market module needs trusted providers. Drafted stories: **(a)** a provider (individual or professional) creates a provider profile, hidden from the Market until verified; **(b)** a professional submits ID, selfie, SIRET (checked against the public register) and VAT number when applicable, while an individual submits ID, selfie and any certification their service type requires; provider data follows the same encryption and audit rules; unverified providers cannot be listed, booked or contacted; **(c)** a parent adds the provider role to their existing account (one account, several roles, PM #13) without losing their parent verification. | Draft v1 US-13 to US-15 (removed from the spec; the approved spec's US-13 is now email change), PM #13 | `provider-verification` |
| 6 | Paid plan (subscriptions) | Will be the project's revenue. Who pays (parents, providers) and for what still has to be defined. | PM #1 | `paid-plans` |
| 7 | External identity verification service | A trustworthy, free or open-source service would speed up verification, catch forgeries better and lighten admin review. Becomes a GDPR data processor. | PM #6 | `automated-identity-verification` |
| 8 | Duplicate account detection | Someone rejected or revoked could sign up again with another email; detect reuse of the same identity document. | Spec, risks | `duplicate-account-detection` |
| 17 | Push and in-app notifications | v1 sends decisions, reminders and closure notices by email only (status is also visible in the app). Push notifications (verification decided, renewal reminder, event updates) make the app feel alive and cut missed reminders; they need device-token storage, consent and per-type settings. | PM decision 2026-10-02 (developer question 5) | `notifications` |
| 16 | Per-user encryption keys (crypto-shredding) before scale | The prototype uses Rails' built-in encryption with one shared key set and real deletion on closure. Before scaling or fundraising, move to one key per user so destroying a closed account's key makes every copy unreadable, backups included (Option B in `docs/api/backend-setup-proposal.md`). A planned migration that re-encrypts existing data. | PM backend decision 2026-10-02 | `per-user-encryption-keys` |
| 15 | Profile photo upload | Users can choose to upload a profile photo; until then the avatar shows their initials. A face helps families recognize each other at events and builds trust, but it is personal data: it must stay optional, be removable at any time, follow the visibility rules (AC-6.1) and erasure (US-11), and needs a rule against photos of children or inappropriate images. | PM design review 2026-10-02 | `profile-photo` |

## Could

| # | Title | Why | Source | Future spec slug |
|---|---|---|---|---|
| 9 | Public family-friendly events from open-data APIs | More events to discover without anyone hosting them in the app, so the Events module isn't empty at launch. Needs a clear "public event" label, since there is no verified host. | PM #7 | `open-data-events` |
| 10 | Additional admin and support roles | Least privilege: e.g. a support role that cannot see ID documents. v1 has a single admin role. | PM #9 | `admin-roles` |
| 11 | Launch outside France and outside the EU | Growth beyond France. Affects accepted documents, languages, business registration checks and data transfers outside the EU. | PM #2 | `international-expansion` |
| 12 | Social login and passkeys | Faster sign-in (Apple, Google, passkeys) means less friction for tired parents. | Spec, out of scope | `social-login` |
| 13 | Two-factor authentication for parents | Optional extra protection for parents (required for admins in v1). | Spec, out of scope | `parent-two-factor` |
| 14 | Login history and active devices for users | Lets a user see where they are logged in and spot suspicious access. | Spec, data table | `account-security-center` |
