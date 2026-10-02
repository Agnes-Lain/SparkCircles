# QA report: Accounts and verification (v1)

> Feature slug: `accounts-and-verification` · Author: qa
>
> PR: [#2](https://github.com/Agnes-Lain/SparkCircles/pull/2), branch `feat/accounts-and-verification`.
> - **Round 1** (2026-10-02): code at `5de0dde`. Verdict FAIL.
> - **Round 2** (2026-10-03, re-test after the developer's fix round): code at `f973051`. Verdict PASS WITH ISSUES.
> - **Round 3** (2026-10-03, check of the R2 fixes and the closing-reason row): code at `2765e0c`.
>
> Sources: [spec](../specs/accounts-and-verification.md) (approved, with AC-7.15 and AC-13.10 added on 2026-10-02), [design](../design/accounts-and-verification.md) (approved, with section 8 for reports), [API contract](../api/accounts-and-verification.md) (updated 2026-10-03), [design system](../SPARKCIRCLES_Design_System_EN.md) v1.4.
> Scope: backend only. That means the Rails API in `api/` and the ERB admin web back office. There is no mobile app yet.

## Round 3 (check, 2026-10-03)

### Round 3 verdict: **PASS**

- **Fixes:** R2-01, R2-02 and R2-03 are fixed.
- **New closing-reason row:** behaves as the PM-approved design section 8 says. Admins see it, the read is audited, it's stored encrypted, and members never get it.
- **Side changes:** all check out.
- **Checks:** all green. The new migration is reversible.
- **Bugs:** no new bug, and no open bug left from rounds 1 and 2.

### Round 3 checks

| Check | Result |
|---|---|
| RuboCop | 142 files, no offenses (my QA specs included) |
| RSpec | 240 examples, 0 failures in 6.4 s (developer + QA rounds 1–2). With my round 3 spec: **245 examples, 0 failures**. |
| Brakeman | 0 security warnings |
| bundler-audit | No vulnerabilities found |
| Migration `20261003150000_add_admin_pending_digest_to_users` | Test DB: up, then `db:rollback` (column gone), then `db:migrate` (column back). I restored the committed `structure.sql` after the pg_dump re-dump, as in round 2. |

### Round 3 results

| Item | Result | Evidence |
|---|---|---|
| **R2-01** own-account report actions | **Fixed** | `_report_card` checks `MemberPolicy#restore_email?`. On one's own report it shows "This report is about your own account. Another admin handles it." and no buttons. The dialog script now ignores openers with no dialog. Developer spec, plus a round 3 QA example (no `data-dialog-open` for restore or close, and the report stays open). |
| **R2-02** nav count label | **Fixed** | The count is `aria-hidden`, followed by visually hidden text from `admin.nav.open_reports` (one/other in EN and FR). The back office runs in English, so the text reads "2 open reports". Developer spec. |
| **R2-03** password step ends the live session | **Fixed** | The password step now writes a separate `admin_pending_digest`. The live `admin_session_digest` only rotates in `complete_login!`, and the code-step lock clears only the pending login. **The developer's change to my R2-03 example (expecting `200`) is the correct expectation**: the round 2 example asserted the buggy behaviour on purpose, as noted then. |
| **Closing reason row** (design section 8) | **Pass** | Round 3 QA examples:<br>• The reason is stored only in the audit entry's encrypted `note`; the raw `audit_events` rows don't contain it.<br>• W5 shows "Closed without restoring" with the reason.<br>• Opening W5 writes a `viewed_member` audit entry whose fields include `report_close_reasons`.<br>• The reason is absent from the member's report-closed and reset emails, from `PUT /password_resets`, `GET /me`, `GET /verification` and `GET /me/public_profile`, and from the downloaded data copy. |
| Back office always in English | **Pass** | `around_action` `I18n.with_locale(:en)` in `Admin::BaseController` only. Round 3 QA example: right after an admin request, the member's report-closed email still uses the French subject (the mailer composes in `user.locale`). A token-less API request still answers in French, and `I18n.locale` is back to the default. Read-only check on the running dev server: `/admin/login` has `lang="en"` even with `Accept-Language: fr`, and `/api/v1/me` still answers "Connecte-toi pour continuer." |
| Caption double-period fix | **Pass** | `sentence_end` helper. Round 3 QA example: "…by Agnes A. The email stayed…" with no "A..". |
| CI HEIC decoding | **Pass (config)** | `.github/workflows/api.yml` installs `libheif-plugin-libde265` with `libvips-dev`. CI is green according to the coordinator, and my HEIC example runs in the suite. The production image still needs the staging upload check from round 2. |
| **Test quality: BUG-04 "sleep"** | **No issue** | No `sleep` anywhere in `api/spec` (`git log -S sleep` finds none). The BUG-04 example in `spec/requests/admin/authentication_spec.rb` uses `travel 31.seconds`, which is time travel: ROTP reads the stubbed clock, so a fresh code exists without waiting. Time is reset after the example. The whole suite runs in about 6.5 s, and the slowest example takes 0.14 s. The PR description's word "sleeps" is inaccurate, but the test is correct. |

### Round 3 notes for the PM

- **A competing password step can still cancel a pending login.** If someone with the password runs the password step while the real admin is on the code step, the admin's pending login is replaced and they must enter their password again. A logged-in session is never affected. This follows from the one-session-per-admin choice and is not a bug.
- **Still open from earlier rounds** (not bugs, outside this PR's code):
  - A staging check that production `libvips` decodes iPhone HEIC
  - The production file storage decision (D-21)
  - GDPR advisor points on backups and audit entries after erasure

### Round 3 tests added by QA (uncommitted)

`api/spec/qa/accounts_and_verification_round3_qa_spec.rb`: 5 examples, all passing.
- Closing reason: admin-only, audited and encrypted
- Closing reason absent from the member's emails, API responses and data copy
- Caption with a single period
- R2-01 own-report explanation
- English back office not leaking into member emails and API

---

## Round 2 (re-test, 2026-10-03)

### Round 2 verdict: **PASS WITH ISSUES**

- **Round 1 bugs:** all 15 (BUG-01 to BUG-15) are fixed, and I checked each fix with evidence. That includes the 4 majors.
- **New and changed requirements:** all implemented, and they behave as specified (AC-7.15, AC-13.10 with design section 8, EXIF stripping, breached-password list, 2FA QR code, SparkCircles brand, French "tu", 60-day renewed device tokens).
- **Regression pass:** clean.
- **New bugs:** 3 minor, no blocker or major:
  - R2-01: on the admin's own report, the action buttons do nothing.
  - R2-02: wrong screen-reader label on the nav report count.
  - R2-03: the password step alone ends the admin's live session.

The PR can merge once the PM accepts these 3 minors, or after a short follow-up. The PM should also review the developer choices listed below.

### Round 2 automated checks

| Check | Command (in `api/`) | Result |
|---|---|---|
| RuboCop | `bundle exec rubocop` | 140 files, **no offenses** (my round 2 QA spec: no offenses either) |
| RSpec | `bundle exec rspec` | Developer + round 1 QA suite: **226 examples, 0 failures, 0 pending** (the 6 round-1 `pending` examples now pass). With my round 2 QA spec: **236 examples, 0 failures** |
| Brakeman | `bin/brakeman --no-pager` | **0 security warnings**, 0 errors |
| bundler-audit | `bundle exec bundler-audit check --update` | **No vulnerabilities found** (new gems `image_processing`, `rqrcode` included) |
| Migrations | test DB: full `db:rollback STEP=13` (empty schema, `audit_events_protect()` dropped), `db:migrate`, `db:rollback STEP=4` (the 4 new migrations), `db:migrate` | All clean and reversible. Running the migrations re-dumps `structure.sql` with a different text form of the CHECK constraints (pg_dump formatting of equivalent `ARRAY[...]` expressions). I restored the committed file; this has no functional impact. |
| Mobile (lint, `tsc`, Jest) | n/a | **Not testable: no mobile app yet** |

Environment: Ruby 4.0.7, libvips 8.18.7 (HEIC/HEIF loader present), PostgreSQL 18 on port 5433.
- Suites ran on the test database.
- I checked the back office in a browser on a temporary server on the test database, with my own seed data. I reset that database afterwards.
- I used the dev server on port 3000 only for a read-only header and title check, and didn't stop it.

### Round 1 bugs: re-test

| Bug | Sev. | Status | Evidence |
|---|---|---|---|
| BUG-01 admin code attempts in the cookie | major | **Fixed** | The round 1 QA example (12 wrong codes with the replayed cookie, then the right code) now ends at `/admin/login`, and the right code no longer logs in. Wrong codes are counted on the account (`otp_failed_attempts`, `otp_locked_until`). The cookie nonce is checked against a digest on the account. `rate_limit` 10 per 15 min on the code steps. Round 2 QA example: after 5 wrong codes, a fresh password login plus the right code is still refused for 15 min. |
| BUG-02 restore keeps the attacker's password | major | **Fixed** | Round 1 QA example passes: login with the old password after restore is refused. `secure_and_unlock!` sets a random password, revokes every device token and the back office session, and queues the reset email. |
| BUG-03 raw tokens in logs and job arguments | major | **Fixed** | See the note on the adapted example below. My round 2 QA examples extend it to the sign-up confirmation token and the "This wasn't me" token: neither appears in stored job arguments nor in ActiveJob/ActionMailer logs at `info`. `MailDeliveryJob.log_arguments = false` adds a second guard. |
| BUG-04 admin session survives logout | minor | **Fixed** | Round 1 QA example passes: a cookie copied before "Log out" gets a redirect to login. |
| BUG-05 click targets under 44 px | major | **Fixed** | Browser, 800 px: no visible link, button, input or summary under 44 px tall on W1, W4, W5 (`getBoundingClientRect`). The W5 dialog buttons are 55 px. |
| BUG-06 statistic id reveals erasure time | minor | **Fixed** | Round 1 QA example passes. The column default is now `gen_random_uuid()`. |
| BUG-07 login timing | minor | **Fixed (code)** | `User.spend_password_check_time` runs a bcrypt compare for unknown emails in the API and the back office, plus a developer spec. I didn't measure timing. |
| BUG-08 W1 hero card hidden | minor | **Fixed** | Browser: with the admin's own verification oldest (40 h), the hero card shows Thomas R. (31 h) with "Over 24 h" and Primary "Review". |
| BUG-09 invisible W3 error | minor | **Fixed** | Developer spec, and the same pattern checked in the browser on the AC-13.10 dialog: a server refusal reopens the dialog with the field error and shows a page notification. |
| BUG-10 field errors | minor | **Fixed** | `_field_error` partial under the field with `aria-describedby`; email kept after a wrong password (developer spec + template). |
| BUG-11 badges | minor | **Fixed** | v1.4 variants (yellow Not accepted / Expired / Pending, neutral Not verified; 4px 10px, 11px/500), developer spec. |
| BUG-12 revocation message null | minor | **Fixed** | `verification.revocation_messages.*` (FR + EN) rendered in `rejection.message`; contract updated. |
| BUG-13 1-year hard token expiry | minor | **Fixed** | Round 2 QA example: 60-day token. Used at day 20, no renewal. At day 35, a renewed token in the `Authorization` response header, only once per device. The renewed token works, and "Log out of all devices" kills both. A device unused for 30 days still gets 401 and no renewal. |
| BUG-14 dialogs | minor | **Fixed** | Browser: native `<dialog>` via `showModal()`, focus moves to the H2, Escape closes, focus returns to the opener, `aria-labelledby` set. Confirmation dialogs exist for restore, close, revoke and role changes. `aria-current="page"` on the active nav link. |
| BUG-15 cosmetic | cosmetic | **Fixed** | `shield-x` icon on "Remove verification", toasts ("You're logged out" seen), W5 caption keeps its case ("\"This wasn't me\" report"), W2 validity date computed in the browser. |

**About the adapted BUG-03 example:** I agree with the change, and the example still proves the fix.
- The token now only exists when the job runs, so the example captures the stored job arguments right after enqueueing. It then runs the jobs with the logger still captured, so the "Performing ..." log lines are included.
- It reads the real token from the delivered email and checks that the token is absent from both.
- It would fail again if a token were passed to a job, or logged by ActiveJob at `info`.
- Limit: it captures only the ActiveJob logger and covers only the reset token. My round 2 examples add the ActionMailer logger and the two other tokens.

### New and changed requirements

| Item | Result | Evidence / note |
|---|---|---|
| **AC-7.15** early renewal | **Pass** | Round 2 QA example: a verified parent's renewal returns 201 with `status: verified`, `verified: true` and `renewal.status: pending`. Other members still see `verified: true` on `GET /users/:id`. The round 1 example (badge kept) passes. Developer specs cover approve (new expiry), reject (old expiry kept, can resubmit), old expiry first (status `pending`) and a second renewal (409). |
| **AC-13.10** + design section 8 | **Pass**, with minor R2-01 | Browser checks:<br>• W4: reports above search, "2 open" yellow badge, caption, date + time columns, Waiting with "Over 24 h", "Review" links, count in the nav.<br>• W5: report card first with yellow "Locked" and "Open" badges, rows with masked emails, Primary "Restore previous email" and Ghost "Close without restoring", each with its own confirmation dialog. The close dialog requires a reason: a whitespace-only note is refused server-side and the dialog reopens with the error.<br>Developer specs: restore and close effects (unlock, random password, tokens revoked, reset email, reason encrypted in the audit log) and the 403 for one's own report. |
| **EXIF/GPS stripping** | **Pass** | Developer spec with a GPS-tagged JPEG, plus a round 2 QA example: an iPhone HEIC is accepted, stored encrypted and re-encoded as JPEG, with no `Exif` marker and `front_content_type` `image/jpeg`. Unreadable files are refused as `invalid_type`. There is a pixel cap against decompression bombs. |
| **Breached-password list** | **Pass** | I downloaded `10-million-password-list-top-100000.txt` from SecLists commit `2d5dc75…` myself. It has 100,000 entries, of which 2,344 have 10+ characters. Compared case-insensitively, every one is in `config/common_passwords.txt`, and the file adds French entries. `PasswordPolicyValidator` reads the file. Round 2 QA example: `Basketball`, `1q2w3e4r5t6y` and `azerty1234` are refused at sign-up with `too_common`. |
| **QR code** (2FA setup) | **Pass** | Browser: the QR renders (finder patterns visible), with the typed key and an "Add to authenticator" link as fallback. The container has `role="img"` and an aria-label naming SparkCircles admin; the SVG is `aria-hidden`. Round 2 QA example: `Cache-Control: no-store`, issuer `SparkCircles admin` in the provisioning URI, sanitized SVG (no script, event handler or foreignObject). Pure black/white QR colours are hard-coded in the controller, which is justified for scannability. |
| **"SparkCircles" branding** | **Pass** | No "SPARKCIRCLES" left in `app/`, `config/`, `lib/` or seeds. Ripple logo SVG in the top bar and login cards. `<title>` is "SparkCircles admin" (also on the running dev server). Sender name and TOTP issuer use the brand. Developer spec. |
| **French "tu"** | **Pass** | No `vous`, `votre` or `vos` in `config/locales/fr.yml`; developer spec guards it. |
| **Device-token renewal** | **Pass** | See BUG-13 above. Contract section 1 documents the header and the 60-day lifetime. |

### Round 2 regression pass (security areas)

| Area | Result |
|---|---|
| Admin TOTP | Account-level lock (5 codes, 15 min), nonce digest rotated at each step, IP rate limit on code steps, backup codes still single use (developer spec). |
| Admin sessions | Logout and role removal end the session server-side. A second full login ends the first (developer choice). **R2-03:** the password step alone also ends it. |
| Device tokens | Per-device logout, all-devices logout, password change, reset, closure and email change all revoke by device, renewed tokens included (developer and QA specs). 30-day inactivity still enforced. |
| Round 1 QA examples (22) | All pass, with no `pending` left. They cover encryption at rest, lockout, closure gate, error shape, mass assignment, the mobile-token refusal on admin routes, self-review refusal, image-grant scope, erasure sweep and file retention. |
| Rate limits | Unchanged from round 1. New `rate_limit` on the admin code steps (code check). |
| Brakeman / audit | Clean. |

### Round 2 new bugs

**R2-01 (minor): On the admin's own report, the W5 buttons do nothing (AC-13.10, design section 8)**
- Steps:
  1. Have an open "This wasn't me" report on the logged-in admin's own account.
  2. Open W5 for that account.
  3. Click "Restore previous email" or "Close without restoring".
- Expected: no actions on one's own report, with a caption like W1's ("Your own verification. Another admin reviews it."). The server already refuses with 403.
- Actual: both buttons are shown, but their dialogs aren't rendered, because `restore_email?` is false for one's own account. Clicking does nothing: `document.getElementById(...)` returns `null` and the script throws a TypeError. There is no explanation.
- Code: `api/app/views/admin/members/_report_card.html.erb` renders the buttons without the policy check that `show.html.erb` uses for the dialogs.

**R2-02 (minor): The nav report count reads "2 open report" (design section 8)**
- Steps: with 2 open reports, inspect the "Members" nav badge.
- Expected: `aria-label="2 open reports"`.
- Actual: `aria-label="2 open report"`. `pluralize` runs under the default `fr` locale, which has no English plural rules.
- Also, an `aria-label` on a plain `<span>` isn't reliably announced. Visually hidden text, for example `<span class="visually-hidden"> open reports</span>`, would be more robust.

**R2-03 (minor): Passing only the password step ends the admin's live back-office session**
- Steps:
  1. Admin A is logged in.
  2. From another browser, someone posts A's email and password to `/admin/login` but doesn't enter a code.
  3. A clicks anything.
- Expected: a live session should only end after the second factor succeeds elsewhere. This matches the developer's own description: "logging in again elsewhere ends the previous session".
- Actual: A is sent to the login page. `SessionsController#create` calls `start_admin_session!`, which overwrites `admin_session_digest`, at the password step.
- Impact: anyone who knows the password but not the code can keep logging the admin out. It doesn't grant access.
- Evidence: round 2 QA example "PM review: passing only the password step ends the admin's live back office session". It asserts today's behaviour and will need updating if this is fixed.
- Fix hint: keep a separate pending-login digest, and replace the live digest only in `complete_login!`.

### Developer choices for the PM to review (not bugs)

1. **One back-office session per admin:** a new full login ends the previous one. This is reasonable for a small admin group and breaks no rule. See R2-03 for the password-step side effect.
2. **Self-action rule on restore and close:** no admin can restore or close a report about their own account (403). AC-13.10 requires this for closing; extending it to restore matches AC-9.3 and is sensible. See R2-01 for the UI side.
3. **Neutral "Closed without restoring" badge:** not in design section 8, which only designs "Restored ✓". Neutral grey fits the design system (no action needed, not a success), but the designer should confirm the badge and the closed-card caption.
4. **Emails write the brand as text** ("SparkCircles") instead of the logo. That's acceptable, since SVG isn't reliable in email clients and v1.4 asks for the name as plain text in copy. A hosted PNG lockup can come later.

Also worth knowing:
- **Renewed tokens:** the previous token stays valid until its own expiry (up to 30 days more), as the contract documents. A leaked old token therefore lives a bit longer. Logout and "all devices" kill both.
- **Production HEIC:** HEIC decoding in production depends on the Debian `libvips` build having libheif with an HEVC decoder. Upload an iPhone photo once on the staging image before launch. iPhones send HEIC by default, and a missing decoder would refuse every iPhone photo as `invalid_type`.
- **Raw confirmation token:** Devise still stores the sign-up/email-change confirmation token raw in `users.confirmation_token` (it's valid 24 h). Devise's default, unchanged since round 1.
- **Unchanged from round 1:** production Active Storage service (open point D-21 in the PR), audit entries after erasure (GDPR advisor), backups.

### Round 2 coverage notes

- These are the same as round 1: mobile UI, push notifications, Events/Community-dependent ACs (7.1, 8.4 real use, 11.7, 11.9) and backups are not testable.
- I didn't measure login timing (BUG-07). I checked the code instead.
- I checked the QR code visually and its provisioning URI, but didn't scan it with a phone.

### Round 2 regression risks

- Auth now has more server-side state: `admin_session_digest`, OTP counters, and `device_id` on tokens. Future auth features (passkeys, parent 2FA, support role) must go through `start_admin_session!` / `complete_login!` and `revoke_device!` / `revoke_all_tokens!`, or they'll reopen BUG-01, BUG-04 or BUG-13.
- Any new email with a one-time link must go through `AccountTokenEmailJob` (or create the token in the mailer), not pass it as an argument.
- Any new upload of personal photos must reuse `ImageSanitizer` before `attach_encrypted`.
- The mobile client must store the renewed token from the `Authorization` response header, or users will be logged out after 60 days.

### Round 2 tests added by QA (uncommitted)

- `api/spec/qa/accounts_and_verification_round2_qa_spec.rb`: 10 examples, all passing. They cover:
  - Breached list at sign-up
  - HEIC accepted and re-encoded without metadata
  - Confirmation and "This wasn't me" tokens absent from stored job arguments and logs
  - Token renewal, single renewal per device, and all-devices logout killing renewed tokens
  - No renewal after 30 days of inactivity
  - AC-7.15 renewal keeps `verified` for others
  - OTP lock surviving a new password login
  - R2-03 (current behaviour)
  - 2FA setup page (`no-store`, issuer, sanitized and labelled QR)
- `api/spec/fixtures/files/qa_photo.heic`: a 3.5 KB HEIC fixture.

### Round 2 bugs to file (blocker and major)

None. The 3 new bugs are minor. Before opening any GitHub issue I'll ask the PM.

---

## Round 1 (2026-10-02, code at `5de0dde`)

### Round 1 verdict: **FAIL**

There are no blockers, and the automated checks are all green. The core rules work and the tests cover them well: neutral messages, token revocation, gates, encryption at rest, the audit log, erasure and file retention.

The PR still fails on **4 major bugs**. Three are security gaps in the trust foundation, and one is an accessibility rule:

- The admin second factor can be brute-forced (BUG-01).
- An email restore leaves the attacker's password working (BUG-02).
- Raw one-time link tokens are written to production logs (BUG-03).
- Back-office click targets are smaller than 44 px (BUG-05).

Each one is a small, local fix.

### Automated checks

| Check | Command (in `api/`) | Result |
|---|---|---|
| RuboCop | `bundle exec rubocop` | 129 files, **no offenses** (my QA spec file: no offenses either) |
| RSpec | `bundle exec rspec` | Developer suite: **174 examples, 0 failures**. With the QA specs: **196 examples, 0 failures, 6 pending** (the pending examples reproduce the bugs below) |
| Brakeman | `bin/brakeman --no-pager` | **0 security warnings**, 0 errors |
| bundler-audit | `bundle exec bundler-audit check --update` | **No vulnerabilities found** (advisory DB updated 2026-09-29) |
| Migrations | `RAILS_ENV=test bin/rails db:rollback STEP=9`, then `db:migrate`, then `db:rollback` / `db:migrate` | All 9 migrations roll back cleanly, including the `audit_events_protect()` function and its triggers, and run again. `db/structure.sql` is unchanged. |
| Mobile (lint, `tsc`, Jest) | n/a | **Not testable: no mobile app yet** |

Environment: Ruby 4.0.7, Rails 8.1.4, PostgreSQL 18 on port 5433, test database. I also used a temporary server on the test database to check the back office in a browser, and a dev server only for rate-limit probes that write nothing. I reset the test database afterwards.

### Acceptance criteria

Evidence: "dev spec" means the developer's RSpec example of the same AC. "QA spec" means `api/spec/qa/accounts_and_verification_qa_spec.rb`.

| AC | Result | Evidence / note |
|---|---|---|
| 1.1 | Pass | dev spec `registrations_spec` |
| 1.2 | Pass | dev spec: `must_be_accepted` on each missing box |
| 1.3 | Pass | Same 202 body; the owner gets an email; nothing is created |
| 1.4 | Pass | `too_short`, `too_common` |
| 1.5 | Pass | dev spec + QA spec (`roles`, `verification_status`, `confirmed_at` are ignored at sign-up) |
| 1.6 | Pass | Strong params whitelist |
| 1.7 | Pass | Roles table; W5 grant/remove; QA spec: a removed admin is locked out at their next click |
| 2.1–2.3 | Pass | dev specs; the gates follow the contract order |
| 2.4 | Pass | `PurgeUnconfirmedAccountsJob` spec; scheduled in `config/recurring.yml` (production) |
| 3.1 | Pass | |
| 3.2 | Pass, with minor BUG-07 | Same body for an unknown email or a wrong password, but the response timing differs |
| 3.3 | Pass | dev spec + QA spec: the right password is refused with 423 during the lock and accepted after 15 min. The sliding window resets only when the last failure is more than 15 min old, which is stricter than the spec and acceptable. |
| 3.4 | Pass, with minor BUG-13 | 30-day inactivity tested; hourly purge job |
| 3.5, 3.6 | Pass | dev specs |
| 4.1–4.4 | Pass | dev specs; rate limit checked live (6th request returns 429) |
| 5.1 | Pass (API) | `GET /legal`. The UI part (form links, unticked box) is not testable: no mobile app |
| 5.2–5.5 | Pass | dev specs (gate `terms_acceptance_required`) |
| 6.1–6.4 | Pass | The public profile only has id, first name, initial, photo_url, `verified`, city. The same for admins. |
| 7.1 | Not testable yet | Depends on Events. The building block `require_verified!` passes (dev `security_spec`) |
| 7.2 | Pass | |
| 7.3 | Pass | JPEG/PNG/HEIC magic bytes checked; back required except for passports |
| 7.4 | Pass (admin side) | W2 refuses an expired date with the design copy (checked in the browser). The app pre-check is not testable |
| 7.5–7.9 | Pass | dev specs; push notification not testable (email only) |
| 7.10 | Pass | dev spec + QA spec (pending: kept; 29 days: kept; 31 days: purged; outcome and type kept) |
| 7.11–7.13 | Pass | |
| 7.14 | Pass (building block) | `403 verification_required` via a test controller |
| **7.15** | **Not implemented yet, new requirement** | Added to the spec after the PR. Today a renewal sets the status to `pending` (the badge is lost) and a rejection wipes the valid expiry. A pending QA example documents it. |
| 8.1 | Pass (API) | `verified` boolean in every public profile. Placement in the UI is not testable |
| 8.2 | Pass | Boolean only, never the reason |
| 8.3 | Not testable | Mobile copy |
| 8.4 | Pass (building block) | First real use is in Events |
| 8.5 | Pass | `verified?` checks the date on every request; revocation applies to the same token at once |
| 9.1 | Pass, with minor BUG-08 | Oldest first, waiting hours |
| 9.2 | Pass | Checked in the browser at 1280 px: two columns, images, DOB, name, expiry field |
| 9.3 | Pass | QA spec: a direct POST approve and a file request on one's own verification return 403 |
| 9.4 | Pass | Neutral message; a parent with the right password never reaches the code step (QA spec) |
| **9.5** | **Fail** | **BUG-01** |
| 9.6, 9.7 | Pass | QA spec: a mobile token gets 403 on every admin route, even an admin's |
| 10.1 | Pass | QA spec dumped `users`, `verifications`, `email_changes` and `audit_events` as JSON from the test database. No plain-text email, pending email, last name, city, DOB, expiry dates, admin note, IP or OTP secret. Passwords are bcrypt. |
| 10.2 | Pass | QA spec: stored blobs are AES-256-GCM, named `*.bin`, typed `application/octet-stream`, with no JPEG header |
| 10.3 | Pass | Keys come from env vars / credentials, never from the database (dev spec) |
| 10.4 | Pass | Audit entry on W2 open, W4 search (found or not), W5 view and every decision. The image grant is tied to one review (QA spec) |
| 10.5 | Pass | A PostgreSQL trigger blocks UPDATE, TRUNCATE and DELETE under 13 months; monthly purge |
| **10.6** | **Fail** | **BUG-03**. Request parameters are filtered correctly (checked in the dev log) |
| 10.7 | Pass (config) | `force_ssl` / `assume_ssl` in production |
| 11.1 | Pass (API) | Password required; the explanatory copy is mobile |
| 11.2, 11.3 | Pass | dev specs + QA spec (a closed account's old token gets 401; after a new login the `closure_pending` gate applies) |
| 11.4 | Pass | QA spec: after erasure, no row in any table (except `audit_events`) contains the user id, and no blobs or attachments are left. Backup retention (7 days, D-16) is not testable here |
| 11.5 | Pass | The statistic has months only; the retention register is empty in v1 |
| 11.6 | Pass, with minor BUG-06 | |
| 11.7 | Not testable yet | Events / Community |
| 11.8 | Pass | |
| 11.9 | Not testable yet | Events |
| 12.1–12.3 | Pass | QA spec: another member's token can't download the copy |
| 13.1–13.7 | Pass | dev specs; neutral 202; old address gets the notice and link |
| **13.8** | **Fail** | **BUG-02** |
| 13.9 | Pass | |

### Bugs

#### Major

**BUG-01: The admin second-factor attempt limit can be bypassed (AC-9.5)**
- Steps:
  1. Log in to `/admin/login` with an admin's password and keep the `_sparkcircles_admin` cookie.
  2. Post wrong codes to `/admin/login/code`, sending the saved cookie each time.
  3. After 12 wrong codes, post the right code with the same saved cookie.
- Expected: after 5 wrong codes the pending login is gone and the admin must start again.
- Actual: the counter (`session[:admin_code_attempts]`) lives in the client-side cookie store, so replaying the cookie resets it. `TwoFactorController` has no `rate_limit` either. Anyone who has the password can try codes without limit for the 10-minute window and repeat, so the second factor can be brute-forced. The right code is still accepted after 12 wrong ones.
- Evidence: QA spec `BUG-01` (pending), plus a confirmation run.
- Fix hint: count attempts server-side (on the user row or in the cache, by user id) and add `rate_limit` on `two_factor#create`.

**BUG-02: Restoring the email after "This wasn't me" leaves the attacker's password working (AC-13.8)**
- Steps:
  1. An attacker who knows the password (AC-13.1 requires it for the change) changes the email.
  2. The owner reports it.
  3. An admin clicks "Restore previous email".
  4. `POST /api/v1/sessions` with the restored email and the old password.
- Expected: the account stays unusable until the owner sets a new password through the reset link.
- Actual: `201` with a token. `Admin::MemberActions#restore_email!` clears `security_locked_at` and keeps `encrypted_password`. The attacker may also have reset the password while the account pointed to their address.
- Evidence: QA spec `BUG-02` (pending).
- Fix hint: scramble the password, or keep the lock until the reset completes.

**BUG-03: Raw one-time link tokens are written to logs (AC-10.6)**
- Steps:
  1. Set the log level to `info` (the production default).
  2. Call `POST /api/v1/password_resets` for an existing account.
  3. Read the log.
- Expected: no credential-like secret in logs.
- Actual: the log shows `Enqueued ActionMailer::MailDeliveryJob ... with arguments: ... "<raw reset token>"`. The same happens for confirmation and email-change tokens (`send_devise_notification` uses `deliver_later`) and for the "This wasn't me" token (`email_changed_notice`). Solid Queue also stores them in clear in `solid_queue_jobs.arguments` until finished jobs are cleared (hourly). Anyone with log access can reset a password or confirm an email change. The reset token is stored digested in `users`, so this undoes that protection.
- Evidence: QA spec `BUG-03` (pending).
- Fix hint: `ActionMailer::MailDeliveryJob.log_arguments = false` (or a custom delivery job), and pass a record id instead of the token where possible.

**BUG-05: Back-office click targets are under 44 px (design section 5, "Web admin: click targets ≥ 44px too")**
- Steps: log in to the back office at 800 px or 1280 px and measure the links.
- Actual (`getBoundingClientRect`):
  - W1 "Review" link: **46×16**
  - W4 "Open" (reports table): **34×16**
  - Text links "← Verifications", "← Members", "Next page" and "add to authenticator": plain inline text, about 16–22 px tall
  - Measured at or above 44 px: buttons, nav links, "Log out", radio rows
- Expected: at least 44 px.

#### Minor

**BUG-04: The admin session still works after "Log out"**
- Steps: save the cookie after a full login, log out, send the saved cookie to `GET /admin/verifications`.
- Actual: 200. Cookie-store sessions can't be revoked server-side, so a stolen cookie stays valid up to the 12-hour timeout.
- Evidence: QA spec `BUG-04` (pending).
- Fix hint: a server-side session store, or a per-session nonce on the user.

**BUG-06: The erased-account statistic reveals the exact erasure time (AC-11.6)**
- The `closed_account_statistics.id` default is `uuidv7()`, whose first 48 bits are the creation time in milliseconds. That gives the erasure day, which is closure + 30 days, so the exact closure date. The developer intended "months only".
- Evidence: QA spec `BUG-06` (pending).
- Fix hint: use `gen_random_uuid()` for this table. Audit entries of erased users also keep a UUIDv7 `subject_user_id` that encodes the exact sign-up time. Worth the GDPR advisor's review together with the open point in spec section 7.

**BUG-07: Login timing reveals whether an email is registered (AC-3.2 principle)**
- `SessionsController#create` returns 401 straight away for an unknown email but runs bcrypt (cost 12 in production) for a known one, so the timing differs.
- Expected: no measurable difference (run a dummy bcrypt comparison).
- The lockout `423` also reveals existence after 5 tries. That one is inherent to AC-3.3 and is noted only.

**BUG-08: The W1 "Oldest waiting" card disappears when the oldest pending verification is the admin's own**
- Seen in the browser: with the admin's own verification waiting 40 h, there is no hero card and no "Over 24 h" badge, although Thomas R. (31 h) is reviewable.
- Expected (W1): the card and Primary "Review" show the oldest verification this admin *can* review.

**BUG-09: The W3 reject error is invisible after a server-side refusal**
- Steps: post a rejection without a reason (for example with the browser's `required` check bypassed). The page re-renders at `/reject`.
- Actual: the error "Choose a reason." is rendered inside the `#reject` modal, which is `display: none` without the URL fragment. The admin sees no feedback and the `role="alert"` is not announced.

**BUG-10: W0/W2 field errors don't follow the design pattern**
- A wrong code shows the message as a top banner and the field gets a red border, but there is no error text under the field with an icon and `aria-describedby` (design "Field error").
- A wrong password also clears the email field.

**BUG-11: Back-office verification badges don't follow the design**
- `verification_badge` shows "Rejected" or "Expired" as `badge-neutral` (humanized status).
- Design and design system: `badge-yellow` "Not accepted" / "Expired". Only "Not verified" is neutral.

**BUG-12: The revocation `rejection.message` is `null` (API contract section 2)**
- The contract defines `rejection` as `{reason, message, note}` for rejected **or revoked** verifications. For `safety_report` / `other`, `message` is `null`, so the app has no plain-words text for AC-7.9.

**BUG-13: Device tokens expire after 1 year even when used every day (AC-3.4)**
- `jwt.expiration_time = 1.year` is a hard `exp`; the allowlist only refreshes `last_used_at`.
- AC-3.4: a parent who keeps using the app stays logged in.
- Fix hint: refresh or rotate the token, or document the cap and have the PM accept it.

**BUG-14: Back-office dialogs and navigation accessibility gaps**
- The CSS `:target` modals (W3, "Remove verification") don't move focus into the dialog, can't be closed with Escape and don't trap focus, despite `aria-modal="true"`.
- "Restore previous email" acts at once, with no confirmation dialog (W5: "each action confirms in a dialog").
- The active nav link has no `aria-current="page"` (the mockups have it).

#### Cosmetic

**BUG-15: Small visual and copy deviations**
- "Remove verification" uses the `log-out` icon.
- Radio inputs shrink to 17–20 px wide next to long reason labels (W3).
- The W5 audit caption lowercases the reason ("\"this wasn't me\" report").
- The W2 validity caption is static instead of the computed date in the design ("valid until 2 Oct 2028").
- Admin feedback uses flash banners instead of toasts.

### Not bugs, but worth the PM's attention

- **AC-7.15** (early renewal) is a new requirement. It is not implemented yet: see the table.
- **Brand v1.4** landed after the PR. The back office still types "SPARKCIRCLES" as text (login card, top bar, `<title>`), where v1.4 asks for the SVG wordmark and "SparkCircles" in copy. It should be updated in a follow-up and is not counted as a bug of this PR.
- **EXIF metadata** (possibly GPS of the parent's home) stays in the stored ID images until the 30-day purge. It is encrypted and admin-only, but stripping it at upload would be better data minimisation.
- **Audit entries after erasure** keep the subject's internal id and, for "This wasn't me" reports, the reporter's encrypted IP, for 13 months. The spec already lists this for the GDPR advisor.
- **Production storage** is `config.active_storage.service = :local`. Before launch it needs an EU bucket or a persistent volume, or ID files and data copies are lost on redeploy.
- **Rate limits** checked live on the dev server, per IP:

  | Endpoint | Limit |
  |---|---|
  | Sign-up | 5/hour |
  | Login | 10/3 min |
  | Password reset | 5/hour |
  | Resend confirmation | 5/hour |
  | "This wasn't me" | 5/hour |
  | Admin password step | 10/3 min |

  Email change (5/hour) is checked in code only. The admin code step has no limit (BUG-01). In the test environment the cache is a null store, so specs can't cover rate limits.
- **Design-system compliance (back office):** colours exist only as CSS custom properties in `admin/shared/_styles.html.erb`, with the v1.3 values, and there are no other hex values in the views. Weights are 400/500. The type scale matches. Contrast pairs match the design's table: Ink 3 captions 5.1:1, yellow badge 5.12:1, error notification 5.76:1, links 4.99–5.35:1. A visible focus ring is set (`:focus-visible`, 2 px green-dark), and inputs use the green-dark border per the design. Reduced motion is respected.

### Coverage notes (not testable and why)

- Mobile app: not testable, there is no app yet. That covers TypeScript types against the contract, UI states, skeletons, the 320 px layout, large text, tap counts and copy for screens S, A, V and B1.
- AC-7.1, 8.4 (real use), 11.7, 11.9: these depend on Events and Community. The `require_verified!` building block and the `verified?` rule are verified.
- Push notifications (AC-7.6, 7.7, 7.9): emails only in v1. Mailers are covered by the dev specs and were not sent for real.
- Backups (AC-10.1, AC-11.4 "including in backups"): this is infrastructure; there is no backup setup in the repo.
- Back-office loading and network-error states: server-rendered pages have neither, so they don't apply.
- I didn't change the dev server or the dev database. I used the dev server only for rate-limit probes that write nothing.

### Regression risks for other modules

- **Events, Community, Travel, Market** will rely on `require_verified!` and `User#verified?`. Implementing AC-7.15 will change what "verified" means during a renewal, so every restricted action must keep using the single `verified?` rule. Don't read `verification_status` directly.
- Any new mailer sent with `deliver_later` and a token in its arguments has BUG-03 until it is fixed globally.
- New admin pages reuse `_styles.html.erb`. Text links there will repeat BUG-05 unless a 44 px link style exists.
- Children's data (family profile) must use `personal_data` (encryption) and be added to `Accounts::Eraser` and `DataExportBuilder`.
- The cookie session is shared by all back-office pages, so BUG-01 and BUG-04 affect any future admin feature.

### Tests added by QA (uncommitted)

- `api/spec/qa/accounts_and_verification_qa_spec.rb`: 22 examples, 16 passing and 6 pending.
- The passing examples cover:
  - Database and storage encryption inspection
  - Lockout behaviour
  - Tokens of closed accounts
  - The closure gate
  - Error shape (400/404)
  - Mass assignment at sign-up and on `PATCH /me`
  - The data-copy owner check
  - Mobile token refused on admin routes
  - A parent can't reach the code step
  - Self-review refusal
  - Image-grant scope
  - Removed admin locked out
  - HTML escaping
  - Full erasure sweep
  - ID file retention boundaries
- The pending examples reproduce BUG-01, 02, 03, 04, 06 and AC-7.15. RSpec flags each one when it starts passing, so its `pending` line can then be removed.

### Bugs to file (blocker and major)

Before opening GitHub issues I'll ask the PM. With approval I'd file:

- BUG-01: admin 2FA attempt limit bypass and no rate limit (AC-9.5)
- BUG-02: email restore keeps the attacker-known password (AC-13.8)
- BUG-03: raw one-time tokens in logs and in the job queue (AC-10.6)
- BUG-05: back-office click targets under 44 px