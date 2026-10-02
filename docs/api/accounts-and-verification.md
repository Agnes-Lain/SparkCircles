# API contract: Accounts and verification (v1)

> Feature slug: `accounts-and-verification` · Author: developer · Date: 2026-10-02 · Updated 2026-10-03 (QA fix round: token renewal, AC-7.15 renewals, AC-13.10, revocation message)
>
> Spec: [`specs/accounts-and-verification.md`](../specs/accounts-and-verification.md) · Design: [`design/accounts-and-verification.md`](../design/accounts-and-verification.md) · Setup: [`backend-setup-proposal.md`](backend-setup-proposal.md)
>
> Scope: the JSON API used by the mobile app. Admin functions are **not** in this API (AC-9.7): they live in the web back office (server-rendered pages under `/admin`, section 9).

## 1. Conventions

- Base path: `/api/v1`. JSON in and out (`Content-Type: application/json`), except the verification upload (`multipart/form-data`) and file downloads.
- HTTPS only in production (AC-10.7).
- IDs are UUIDs. Dates are ISO 8601 (`2026-10-02`), times ISO 8601 UTC (`2026-10-02T12:05:00Z`).
- Language: `Accept-Language: fr` or `en` selects the language of `message` texts and emails; the account's `locale` wins for emails.
- Sensitive values never appear in URLs (AC-10.6). One-time tokens from email links are sent in the request **body**.

### Authentication

- `POST /sessions` (and the other endpoints that log a device in) returns `{ "token": "<jwt>" }`. The app stores it in secure storage and sends `Authorization: Bearer <jwt>` on every request.
- One token = one device. A token stops working when: the user logs out on that device, logs out everywhere, resets or changes the password, confirms an email change on another device, closes the account, reports "This wasn't me", or **doesn't use it for 30 days** (AC-3.4). Then the API answers `401 unauthorized` and the app shows Log in.
- **Token renewal (AC-3.4):** a token is valid 60 days. While a device keeps using the app, a response may carry a renewed token in its `Authorization: Bearer <jwt>` header (when less than 30 days are left). The app replaces the stored token with it. The previous token keeps working until its own expiry; logging out the device ends both.
- A token never grants admin access, even for an admin (AC-9.7).

### Account gates

An authenticated request can be refused with `403` and one of these codes, checked in this order. Each gate lists what stays allowed.

| Code | When | Still allowed |
|---|---|---|
| `email_not_confirmed` | Email not confirmed (AC-2.3) | `GET /me`, `POST /email_confirmations/resend`, `DELETE /sessions/current` |
| `closure_pending` | Account closed less than 30 days ago (AC-11.3) | `GET /me`, `DELETE /closure`, `DELETE /sessions/current` |
| `terms_acceptance_required` | A new terms/privacy version requires acceptance (AC-5.5) | `GET /me`, `GET /legal`, `POST /me/terms_acceptance`, `POST /closure`, `DELETE /sessions/current`, `DELETE /sessions` |

### Errors

```json
{ "error": { "code": "validation_failed", "message": "Check the highlighted fields.", "details": { "password": ["too_short"] } } }
```

`details` only exists for `validation_failed`: field name → list of error keys (the app maps keys to the design copy).

| Status | Codes |
|---|---|
| 400 | `bad_request` (missing or malformed parameters) |
| 401 | `unauthorized` (missing, invalid, revoked or expired token), `invalid_credentials` |
| 403 | `email_not_confirmed`, `closure_pending`, `terms_acceptance_required`, `forbidden`, `verification_required` |
| 404 | `not_found` |
| 409 | `verification_pending`, `email_taken` |
| 422 | `validation_failed`, `invalid_or_expired_token`, `invalid_password` |
| 423 | `account_locked` |
| 429 | `rate_limited` |

Field error keys: `blank`, `invalid` (email format), `too_short` (password < 10), `too_common` (password in the common list), `must_be_accepted` (18+ / terms boxes), `same_as_current` (email change), `too_large`, `invalid_type`, `expired` (document).

### Rate limits (per IP, `429 rate_limited`)

Sign-up 5/hour · login 10/3 min · password reset, resend confirmation, email change, "This wasn't me" 5/hour.

## 2. The `me` object

Returned by `GET /me` and by every endpoint that logs a device in. Only the owner ever sees it.

```json
{
  "id": "0192…",
  "first_name": "Claire",
  "last_name": "Martin",
  "email": "claire@example.com",
  "pending_email": null,
  "city_shown": "Croix-Rousse, Lyon",
  "locale": "fr",
  "roles": ["parent"],
  "email_confirmed": true,
  "terms_acceptance_required": false,
  "closure": null,
  "marketing_opt_in": false,
  "marketing_opt_in_changed_at": null,
  "consents": {
    "terms_version": "1.0", "terms_accepted_at": "2026-10-02T12:05:00Z",
    "privacy_version": "1.0", "privacy_accepted_at": "2026-10-02T12:05:00Z"
  },
  "verification": {
    "status": "verified",
    "verified": true,
    "expires_on": "2028-10-02",
    "expires_soon": false,
    "revoked": false,
    "submitted_at": "2026-10-02T12:05:00Z",
    "rejection": null,
    "renewal": null
  }
}
```

- `verification.status`: `not_verified` · `pending` · `verified` · `rejected` · `expired` (AC-7.x). `verified` is the server rule (status verified **and** not past `expires_on`, AC-8.5). `expires_soon` is true within 30 days of expiry (A1 "Expires soon"). `revoked` is true when an admin removed the verification (A1 "Removed"; status is then `not_verified`).
- `rejection` (when `rejected` or `revoked`): `{ "reason": "photo_blurry", "message": "The photo is blurry. Take a new one in good light.", "note": "optional admin note" }`. Reason keys: `photo_blurry`, `document_cut_off`, `document_expired`, `document_not_accepted`, `selfie_mismatch`, `name_mismatch` (design W3); revocation uses `safety_report` or `other`, also with a plain-words `message` (AC-7.9).
- `renewal` (AC-7.15): `null`, or, while the parent is still verified and has sent a new verification early, `{ "status": "pending" | "rejected", "submitted_at": "…", "rejection": null | { reason, message, note } }`. The app shows "Renewal pending"; `status` stays `verified` and `verified` stays `true` until the old verification expires or the renewal is decided. A rejected renewal keeps the old expiry and can be sent again.
- `closure` (during the grace period): `{ "closed_at": "…", "erasure_on": "2026-11-01" }`.
- `pending_email`: the new address waiting for confirmation (A3 caption), else `null`.

## 3. Sign-up and email confirmation (US-1, US-2, US-5)

### `POST /registrations` · no auth · AC-1.1–1.6, 5.1–5.3

```json
{ "user": { "first_name": "Claire", "last_name": "Martin", "email": "claire@example.com", "password": "…",
            "adult_confirmed": true, "terms_accepted": true, "marketing_opt_in": false, "locale": "fr" } }
```

- `202 Accepted` `{ "status": "check_inbox" }`, **the same body whether the email is new or already registered** (AC-1.3). New address: account created unconfirmed, role `parent`, status `not_verified`, consent versions recorded (AC-1.5, 5.2), confirmation email sent. Existing address: nothing created, the owner gets a "someone tried to register" email.
- `422 validation_failed` with `details` for: missing names, email format, password `too_short`/`too_common` (AC-1.4), `adult_confirmed`/`terms_accepted` `must_be_accepted` (AC-1.2). Any other parameter (e.g. `roles`) is ignored (AC-1.5, 1.6).

### `POST /email_confirmations` · no auth · AC-2.1, 2.2, AC-13.3, 13.6, 13.9

Used by both the sign-up link and the email-change link (link: `<APP_LINK_BASE>/confirm-email?token=…`).

```json
{ "token": "…" }
```

- Sign-up confirmation: `200` `{ "token": "<jwt>", "user": { me } }`: the device is logged in (AC-2.1).
- Email change confirmation: `200` `{ "token": null, "user": null }` when the request has no valid `Authorization` header, else `{ "token": null, "user": { me } }`. The account's email becomes the new address, the new address gets a confirmation, the old address gets a notice with a "This wasn't me" link (AC-13.7), and **every other device** is logged out (AC-13.9; the calling device keeps its token if it sent one).
- `422 invalid_or_expired_token` for an expired (> 24 h), used or superseded link (AC-2.2, 13.3, 13.4).
- `409 email_taken` if the new address was taken in the meantime; nothing changes (AC-13.6).

### `POST /email_confirmations/resend` · auth optional · AC-2.2, 2.3

`{ "email": "claire@example.com" }` (ignored when authenticated). Always `202` `{ "status": "check_inbox" }`.

## 4. Sessions and passwords (US-3, US-4)

### `POST /sessions` · no auth · AC-3.1–3.3, 2.3, 11.3

```json
{ "email": "claire@example.com", "password": "…", "device_name": "iPhone de Claire" }
```

- `201` `{ "token": "<jwt>", "user": { me } }`. Unconfirmed accounts, accounts in closure and accounts with terms to accept also get a token; the account gates then limit what it can do (section 1).
- `401 invalid_credentials` for a wrong email **or** wrong password, same message (AC-3.2).
- `423 account_locked` after 5 failures within 15 minutes, for 15 minutes; the owner gets an email (AC-3.3). Also returned while an account is locked by a "This wasn't me" report (AC-13.8).

### `DELETE /sessions/current` · auth · AC-3.5 → `204`. Only this device is logged out.
### `DELETE /sessions` · auth · AC-3.6 → `204`. Every device, this one included, is logged out.

### `POST /password_resets` · no auth · AC-4.1

`{ "email": "…" }` → always `202` `{ "status": "link_sent_if_account_exists" }`. A link (`<APP_LINK_BASE>/reset-password?token=…`, valid 1 hour) is emailed only if the account exists.

### `PUT /password_resets` · no auth · AC-4.2, 4.3

`{ "token": "…", "password": "…" }` → `200` `{ "token": "<jwt>", "user": { me } }`: password changed, **every other device logged out**, confirmation email sent, this device logged in. `422 invalid_or_expired_token` (expired or used, AC-4.3) or `422 validation_failed` (password rules).

### `PUT /me/password` · auth · AC-4.4

`{ "current_password": "…", "password": "…" }` → `200` `{ me }`, other devices logged out. `422 invalid_password` (wrong current password) or `422 validation_failed`.

## 5. Profile, privacy and visibility (US-5, US-6, US-13)

### `GET /me` · auth → `200` `{ me }`

### `PATCH /me` · auth · AC-6.1, 7.8

`{ "user": { "first_name": "…", "last_name": "…", "city_shown": "…", "locale": "en" } }` → `200` `{ me }`. Changing the first or last name of a **verified** parent sets the verification back to `not_verified` (AC-7.8). Email can't be changed here (see below).

### `GET /me/public_profile` · auth · AC-6.3 → `200` the public profile object below, exactly as others see it.

### `GET /users/:id` · auth · AC-6.1, 6.2, 6.4, 8.1, 8.2, 11.2

```json
{ "id": "0192…", "first_name": "Claire", "last_name_initial": "M", "photo_url": null, "verified": true, "city_shown": "Croix-Rousse, Lyon" }
```

Only these fields, whatever the requester's role (AC-6.4). `verified` is a boolean: the reason of a non-verification is never exposed (AC-8.2). `404` for an unknown, unconfirmed or closed account (AC-11.2).

### `PUT /me/marketing` · auth · AC-5.4

`{ "marketing_opt_in": true }` → `200` `{ me }` with the new `marketing_opt_in_changed_at`.

### `GET /legal` · auth optional · AC-5.1, 5.5

```json
{ "terms": { "version": "1.0", "url": "https://…/terms" }, "privacy": { "version": "1.0", "url": "https://…/privacy" },
  "requires_acceptance": true, "changes": ["…written by the PM…"] }
```

### `POST /me/terms_acceptance` · auth · AC-5.5, 5.2

`{ "terms_version": "1.1", "privacy_version": "1.1" }` → `200` `{ me }`. `422 validation_failed` if the versions aren't the current ones.

### `POST /me/email_change` · auth · AC-13.1, 13.2, 13.4, 13.5

`{ "email": "new@example.com", "current_password": "…" }`

- `202` `{ "status": "check_new_inbox" }`, **identical whether or not the new address belongs to another account** (AC-13.5). Free address: a confirmation link valid 24 h goes to the new address, the account email stays the old one, a new request replaces the previous link (AC-13.4). Taken address: no change possible, the owner of that address gets a "someone tried to use your email" message.
- `422 invalid_password` (nothing changes, no email sent, AC-13.1), `422 validation_failed` (`invalid`, `same_as_current`).

### `POST /email_change_reports` · no auth · AC-13.7, 13.8

`{ "token": "…" }` (from the "This wasn't me" link in the notice sent to the old address, valid 30 days) → `202` `{ "status": "account_secured" }`: every device logged out, account locked, report shown to admins, audit entry recorded. `422 invalid_or_expired_token`.

## 6. Identity verification (US-7, US-8)

### `GET /verification` · auth → `200` the `verification` object of `me`.

### `POST /verification` · auth · `multipart/form-data` · AC-7.3, 7.5

| Field | Rules |
|---|---|
| `document_type` | `passport`, `national_id_card`, `driving_licence`, `residence_permit`, `other_residence_card` |
| `document_front` | file, JPEG/PNG/HEIC, ≤ 10 MB |
| `document_back` | same, **required** unless `document_type` is `passport` |
| `selfie` | same |
| `date_of_birth` | `YYYY-MM-DD`, 18+ |

- `201` `{ "verification": { … "status": "pending" } }`. For a parent who is still verified (renewal, AC-7.15): `"status": "verified"` with `"renewal": { "status": "pending" }`.
- Photos are re-encoded by the server without any metadata (EXIF, GPS), then encrypted before storage (AC-10.2). PNG stays PNG; JPEG and HEIC are stored as JPEG.
- `409 verification_pending` if one is already pending, renewals included (AC-7.5).
- `422 validation_failed` (`blank`, `invalid_type` for files that aren't readable images, `too_large`, `invalid`).

### Verification rule used by every module (AC-7.1, 7.14, 8.4, 8.5)

Any endpoint restricted to verified users answers `403 verification_required` with the message "Verify your identity to take part." when `verified` is false. The first endpoint using it is event creation (Events feature).

## 7. Closure (US-11)

### `POST /closure` · auth · AC-11.1, 11.2

`{ "current_password": "…" }` → `202` `{ "closure": { "closed_at": "…", "erasure_on": "2026-11-01" } }`. Every device logged out, profile hidden, marketing stopped, confirmation email with the erasure date. `422 invalid_password`.

### `DELETE /closure` · auth · AC-11.3

Allowed during the 30-day grace period (log in first; the token works with the `closure_pending` gate) → `200` `{ me }`, account restored as it was. `404 not_found` if no closure is pending.

After 30 days the account and its personal data are erased by a scheduled job (AC-11.4–11.8): there is no endpoint.

## 8. Copy of my data (US-12)

### `POST /data_export` · auth · AC-12.1, 12.3 → `202` `{ "data_export": { "status": "pending", "requested_at": "…" } }`. A new request while one is pending returns the pending one.
### `GET /data_export` · auth → `200` `{ "data_export": { "status": "pending" | "ready" | "expired", "requested_at", "delivered_at", "expires_at" } }` or `{ "data_export": null }`.
### `GET /data_export/download` · auth · AC-12.2 → `200` `application/json` file (`sparkcircles-data.json`). `404 not_found` when not ready, `410`-style `404` after 7 days (status `expired`).

The file contains: account (names, email, locale, dates), profile, roles, consents and marketing history, verification outcomes (status, document type, decision and expiry dates; never the images), data-export history.

## 9. Web back office (not part of the JSON API)

Server-rendered pages under `/admin`, cookie session with CSRF protection, password + 6-digit authenticator code (AC-9.5), logged out after 12 hours of inactivity. Any request with a mobile token is refused there (AC-9.7). Pages: log in + code (W0, QR code setup at the first login; 5 wrong codes lock the code step for 15 minutes; logout ends the session on the server), verification queue (W1), review with approve / not accepted (W2, W3), "This wasn't me" reports and member search with a reason (W4), member detail with role changes, verification removal and the open report (W5: "Restore previous email" or "Close without restoring", both confirmed in a dialog; both invalidate the current password, end every device session and send a reset link; closing needs a reason kept encrypted in the audit log; no admin acts on their own account, AC-13.8, AC-13.10). Every view of sensitive data writes an audit entry (AC-10.4).

One-time tokens (confirmation, reset, "This wasn't me") never go through job arguments or logs: the email jobs read or create them when they run (AC-10.6).

## 10. Acceptance criteria → endpoints

| AC | Where |
|---|---|
| 1.1–1.6, 5.1–5.3 | `POST /registrations` |
| 1.7, 9.6 | back office W5 (roles) |
| 2.1, 2.2 | `POST /email_confirmations` |
| 2.3 | account gate `email_not_confirmed`, `POST /email_confirmations/resend` |
| 2.4 | job: delete unconfirmed accounts after 7 days |
| 3.1–3.3 | `POST /sessions` |
| 3.4 | token inactivity rule (30 days) |
| 3.5, 3.6 | `DELETE /sessions/current`, `DELETE /sessions` |
| 4.1–4.3 | `POST`/`PUT /password_resets` |
| 4.4 | `PUT /me/password` |
| 5.4 | `PUT /me/marketing` |
| 5.5 | gate `terms_acceptance_required`, `GET /legal`, `POST /me/terms_acceptance` |
| 6.1–6.4, 8.1, 8.2 | `GET /users/:id`, `GET /me/public_profile` |
| 7.1, 7.14, 8.4, 8.5 | `verified?` rule, `403 verification_required` |
| 7.2 | no gate on non-restricted endpoints |
| 7.3–7.5 | `POST /verification` |
| 7.6, 7.7, 7.9, 9.1–9.3 | back office W1–W3, W5 |
| 7.8 | `PATCH /me` |
| 7.10 | job: erase ID files 30 days after the decision |
| 7.11–7.13 | approval rule + daily expiry/reminder job |
| 7.15 | `POST /verification` renewal, `verification.renewal`, back office decision |
| 8.3 | app copy (B1) |
| 9.4, 9.5, 9.7 | back office auth |
| 10.1–10.3, 10.6 | encryption, filtered logs, no sensitive data in URLs |
| 10.4, 10.5 | audit log (back office) |
| 10.7 | HTTPS |
| 11.1–11.3, 11.9 | `POST`/`DELETE /closure` (11.9: Events feature) |
| 11.4–11.8 | job: erase closed accounts after 30 days |
| 12.1–12.3 | `/data_export` |
| 13.1–13.6, 13.9 | `POST /me/email_change`, `POST /email_confirmations` |
| 13.7, 13.8 | `POST /email_change_reports`, back office W4/W5 (restore) |
| 13.10 | back office W5 (close without restoring) |
