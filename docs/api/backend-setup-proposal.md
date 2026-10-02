# Backend setup proposal (`api/`)

> Author: developer · Date: 2026-10-02 · **Status: reviewed by the PM on 2026-10-02.** All decisions are approved or changed by the PM (D-37 approved and D-23 changed on 2026-10-02). The skeleton in `api/` is set up per section 11.
>
> Serves: [`specs/accounts-and-verification.md`](../specs/accounts-and-verification.md) (approved 2026-10-02, amended with US-13 email change and AC-9.7 web back office), designed so it doesn't block the [backlog](../backlog.md): provider role (#5), paid plans (#6), several roles per account, extra admin roles (#10), children data (#3), per-user encryption keys (#16).
>
> Legend: **Approved** = PM accepted my recommendation · **Changed** = PM chose differently, text updated · **Awaiting PM** = still open.

---

## 1. Versions (checked on 2026-10-02)

| | Latest stable | Used |
|---|---|---|
| Ruby | 4.0.7 | 4.0.7 (rbenv, `api/.ruby-version`) |
| Rails | 8.1.4 | 8.1.4, API-only |
| PostgreSQL | 18.6 | 18.6 locally (Homebrew `postgresql@18`, port 5433); 14/15/16 untouched |

- **D-1 Approved** Ruby 4.0.7.
- **D-2 Approved** Rails 8.1.4, API-only.
- **D-3 Approved** PostgreSQL 18 locally on port 5433 and in production (native `uuidv7()`).
- **D-4 Approved** Native gem builds on this Mac need `DEVELOPER_DIR=/Library/Developer/CommandLineTools`. **New finding during setup:** the Command Line Tools' newest SDK (MacOSX 27.0) breaks the linker, so builds also need `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk` (26.5). Documented in `api/README.md`.

## 2. Authentication for the mobile app

- **D-5 Changed: Devise + devise-jwt** for the mobile app's tokens, **devise-two-factor** for the admin second factor (instead of the Rails 8 generator). Devise modules used:
  - `database_authenticatable`, `registerable` (behind our own JSON endpoint, so AC-1.3's neutral answer is respected)
  - `confirmable` with `reconfirmable`: covers sign-up confirmation (24 h link, AC-2.x) and the email-change flow (`unconfirmed_email`, only the latest link works, US-13). Extra rules of US-13 (password required, notice to the old address with "This wasn't me", conflict checks) are added on top.
  - `recoverable` (1 h reset link, AC-4.x); a successful reset or password change revokes the user's other tokens.
  - `lockable` (5 attempts, unlocked after 15 min by time, AC-3.3). Small gap to close in code: Devise counts consecutive failures without a time window; I'll reset the counter when the last failure is older than 15 minutes.
  - `timeoutable`: see D-6.
- **D-6 Changed: session lifetime.** Devise's `timeoutable` works on a cookie session, which a JWT client doesn't have. So:
  - **Parents (mobile, JWT):** devise-jwt's **Allowlist revocation strategy**: one row per issued token (`jti`, device label, `last_used_at`). A token is refused when its row is gone or unused for 30 days (AC-3.4). `last_used_at` is refreshed at most once per hour.
  - **Admins (web back office, cookie session):** `timeoutable` with 12 hours, as approved (D-12).
- **D-7 Changed: logout and revocation** through the allowlist: log out this device = delete its row (AC-3.5); log out everywhere = delete all the user's rows (AC-3.6, also used by reset, password change, email change, closure and "This wasn't me").
- **D-8 Changed:** confirmation and reset tokens come from Devise (stored as digests, single-use).
- **D-9 Changed:** lockout through Devise `lockable` (D-5), plus Rails 8 `rate_limit` per IP (D-30).
- **D-10 Approved** Breached passwords: local list of the 100,000 most common, as a custom validator.
- **D-11 Changed:** admin second factor with **devise-two-factor** (TOTP authenticator app, `rotp` underneath; its OTP secret is stored with Active Record Encryption), plus its backup codes extension (hashed single-use recovery codes). It applies to the back office login only.
- **D-12 Approved** Admin sessions end after 12 hours of inactivity.
- **AC-9.7 consequence:** admin routes accept **only** the back office cookie session with 2FA, never a mobile JWT. An admin who logs in to the mobile app gets parent abilities only.

## 3. Roles and authorization

- **D-13 Approved** `roles` join table (`user_id`, `name`, `granted_by_id`, unique on user + name). v1 values `parent`, `admin`; later `provider`, `support`.
- **D-14 Approved** Pundit, with `verify_authorized` on every controller.
- **D-15 Approved** One `user.verified?` rule (status verified and expiry in the future) and a `require_verified!` helper (AC-7.14, AC-8.4, AC-8.5).

## 4. Encryption of sensitive data

- **D-16 Changed: Option A, Rails built-in Active Record Encryption with one key set kept outside the database.** Per-user keys (Option B, Lockbox) are deferred to backlog #16; `lockbox` is not installed.
  - Keys: production reads `ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY`, `…_DETERMINISTIC_KEY`, `…_KEY_DERIVATION_SALT` from environment variables (host secret manager); development reads them from `config/credentials/development.yml.enc` (its key file is git-ignored); tests use throwaway keys. Never in the database or git (AC-10.3).
  - `support_unencrypted_data = false`: an encrypted column can never be read or written in plain text by mistake.
  - **Erasure (AC-11.4):** at closure + 30 days a job **really deletes** the personal data (rows, files) and anonymizes what must stay (statistics, "Former member"). **Main database backups are kept 7 days**, so erasure reaches every backup by day 37. To confirm with the GDPR advisor.
- **D-17 Approved, updated** Encrypted fields: email (and pending `unconfirmed_email`), full last name, date of birth, city/neighborhood, document details and expiry date, admin notes, IP addresses, admin OTP secret. Not encrypted: first name, last-name initial, roles, verification status, consent records.
- **D-18 Changed: deterministic only where lookup is needed:** `email` and `unconfirmed_email` are deterministic (`downcase: true`) so Devise can find the account at login and a unique index can enforce one account per address (AC-1.3, AC-13.5, AC-13.6). Every other field is non-deterministic. The blind index is dropped.
- **D-19 Changed: key management.** One key set per environment, generated with `bin/rails db:encryption:init`. Rotation uses Rails' built-in support for previous keys. **Losing the production keys means losing the encrypted data**, so keep them in two safe places.
- **D-20 Approved** One `AccountEraser` service for unconfirmed accounts after 7 days (AC-2.4) and closed accounts after 30 days (AC-11.4).
- **Easy migration to per-user keys later (backlog #16):** every sensitive attribute is declared in one model concern (`EncryptedPersonalData`), so the encryption scheme changes in one place. The future migration will need a re-encryption task and an email lookup column (blind index), because per-user keys can't be deterministic across users.

## 5. ID documents and selfies

- **D-21 Approved** Active Storage on a private EU bucket (Scaleway Object Storage), no public URLs, object versioning off. Local disk in development and tests. **To approve later:** Active Storage needs the `aws-sdk-s3` gem to talk to an S3-compatible bucket. It isn't installed yet; I'll ask before the first production deploy.
- **D-22 Changed (follows D-16):** files are encrypted by the app before upload with AES-256-GCM, using Rails' own encryption cipher and a key derived from the app's encryption keys (a small service, no gem). Provider-side encryption alone wouldn't satisfy AC-10.2. Upload goes through the API (multipart, max 10 MB, JPEG/PNG/HEIC); analyzers and previews off; generic filenames.
- **D-23 Changed by the PM** Admins view files only through an audited back office endpoint that decrypts and streams them. Files are kept **up to 30 days after the decision** so an admin can double-check it, then deleted by a daily sweep (spec AC-7.10).

## 6. Audit log

- **D-24 Approved** Plain Rails `audit_events` table (who, which user, what, reason, when, encrypted IP); a PostgreSQL trigger blocks updates and early deletes; kept 13 months then purged monthly. Also records "This wasn't me" reports (AC-13.8) and admin role changes (AC-9.6).

## 7. Background jobs and email

- **D-25 Approved** Solid Queue recurring jobs: unconfirmed accounts (7 days), closed accounts (30 days), verification expiry and 30/7-day reminders, ID file sweep, stale tokens (30 days), data-copy files (7 days), audit purge (monthly).
- **D-26 Approved** Action Mailer + `deliver_later`, French and English templates, Scaleway Transactional Email over SMTP.
- **D-27 Approved** Solid Cache for `rate_limit`; Action Cable skipped.

## 8. API conventions

- **D-28 Approved** RESTful routes under `/api/v1`, contract in `docs/api/accounts-and-verification.md` before coding.
- **D-29 Approved** Jbuilder views per audience (AC-6.4 whitelist), `snake_case`, ISO 8601 UTC dates, UUID IDs, errors `{ "error": { "code", "message", "details"? } }`, Pagy pagination.
- **D-30 Approved** CORS for local origins in development only (`Authorization` header exposed, devise-jwt returns the token there); `rate_limit` on auth endpoints; HTTPS forced in production (`force_ssl`, HSTS, `/up` excluded); **markdown contracts only** for API docs.

What the API offers the future Expo app: JWT in the device's secure storage, sent as `Authorization: Bearer`; `GET /api/v1/me` with account state; confirmation, reset and "This wasn't me" links that open the app or a small web page on our domain.

## 9. Testing and quality

- **D-31 Approved** RSpec + FactoryBot + shoulda-matchers; RuboCop omakase; Brakeman; bundler-audit; GitHub Actions workflow at the repo root (`.github/workflows/api.yml`) that runs only on `api/**` changes, with a PostgreSQL 18 service. `bin/ci` runs the same checks locally. Rails' generated Dependabot config was **not** kept (it would open PRs automatically); say if you want it.

## 10. Hosting and EU data residency

- **D-32 Approved** Scaleway (Paris): managed PostgreSQL (backups 7 days, D-16), Object Storage, Transactional Email, Secret Manager, deployed with Kamal. Proposal only: no cloud account created.
- **D-33 Approved** Staging and production in the EU; production data never copied elsewhere.

## 11. Project structure and setup

- **D-34 Approved** UUID primary keys (generator default set; tables will use `uuidv7()`).
- **D-35 Approved** Time zone `Europe/Paris`, locales `fr` (default) and `en`.
- **D-36 Approved, done.** Commands run:

```bash
export DEVELOPER_DIR=/Library/Developer/CommandLineTools
export SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk
export RBENV_VERSION=4.0.7
brew install postgresql@18          # port set to 5433, started with brew services
rails _8.1.4_ new api --api --database=postgresql --skip-test --skip-system-test \
  --skip-action-cable --skip-action-mailbox --skip-action-text --skip-devcontainer --skip-git
# Gemfile: jbuilder, rack-cors, devise, devise-jwt, devise-two-factor, pundit, pagy,
#          rspec-rails, factory_bot_rails, shoulda-matchers (image_processing removed: no image variants)
bundle install
bin/rails generate rspec:install
bin/rails credentials:edit --environment development   # development encryption keys
bin/rails db:prepare
```

The app module is named `SparkCircles` (not the default `Api`, which would clash with the `Api::V1` controllers).

## 12. Web back office (new, AC-9.7)

- **D-37 Approved by the PM (2026-10-02), admin area in the same Rails app: how to build the admin web back office with the least effort.** Recommended: **an admin area served by the same Rails app.**
  - What it is: an `Admin::` namespace (e.g. on `admin.<domain>`) with its own controllers inheriting from `ActionController::Base`, server-rendered ERB views, cookie session + CSRF protection added back **only** for those routes, Devise web login for admins with devise-two-factor and 12 h `timeoutable`. Plain CSS using the design system values, no JavaScript framework (a little Turbo later if useful).
  - Why: it's the Rails you already know (controllers, views, forms); it reuses the same models, Pundit policies, encryption, audit log and jobs, so a rule written once applies to the app and the back office; one deploy, one database, no second API client to build.
  - Trade-offs: the API-only app gets a few middlewares back (cookies, session, flash), scoped to the admin routes; the admin pages need some CSS (if you want Tailwind classes matching the design system, `tailwindcss-rails` is one more gem to approve); the admin area shares the API's deploy, so a bad admin change can affect the API (mitigated by tests and CI).
  - Alternative 1, **separate Rails app** for admins, sharing the database: stronger isolation (can be hidden behind an IP allowlist or VPN), but duplicated models and rules, two deploys, double maintenance.
  - Alternative 2, **admin gem** (ActiveAdmin, Administrate, Avo): generic screens in hours, but built for editing tables. Required reasons on every sensitive view, audited reads, no self-review (AC-9.3) and the designer's screens all fight the gem; the paid features of some of these gems also cost money.
  - Alternative 3, **separate JavaScript web app** (React) calling `/api/v1/admin`: most flexible UI, but a second frontend stack and token handling in a browser, which is the most work.

## 13. Open decisions for the PM

1. ~~**D-37 Web back office**~~ Approved: admin area in the same Rails app. (Alternatives were: separate Rails app, admin gem, or separate JavaScript app.)
2. **Later, not blocking:** approve `aws-sdk-s3` before the first deploy (D-21); `tailwindcss-rails` only if D-37 is chosen and you want Tailwind in the back office; Dependabot (D-31).
3. **App domain** (before email flows ship), and the **GDPR advisor** checks (backups reaching erasure at day 37, audit entries after erasure).
