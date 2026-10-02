# Spec: Accounts and verification (v1)

> Feature slug: `accounts-and-verification` · Author: po · **Status: Approved by the PM on 2026-10-02** · Date: 2026-10-02
>
> Amended 2026-10-02 at the PM's request: email change, web admin
>
> **Scope: v1 only, for parents and admins.** It is the foundation every module builds on. Everything deferred (service providers, paid plans, automated verification, extra admin roles…) is in [`docs/backlog.md`](../backlog.md).
>
> **Confirmed by the PM** (answers to draft v1):
> - "Subscription" means account registration (*inscription*). A paid plan comes later (backlog).
> - Launch: France only, French and English, data hosted in the EU.
> - Only adults (18+) have accounts. Children are never users; their information belongs to the family profile (separate spec).
> - One account can hold several roles (v1 uses only "parent" and "admin"; "provider" comes later).
> - v1 identity verification = manual review by an admin. A single admin role.
> - Joining an event never requires verification. **Hosting an event does.** The host's per-event "verified users only" option belongs to the Events feature; this spec makes the verification status exist, visible and usable to restrict access.
> - On account closure, personal data is erased. Only non-identifying statistics and what the law requires are kept.
>
> **Also confirmed:** 30-day grace period before erasure, verification valid for at most 2 years.

---

## 1. Objective

Parents need to trust the people they meet through SPARKCIRCLES before they bring their children to an event, share a school pick-up or hand over their home. This feature gives everyone a secure account, protects their personal data under GDPR, and makes identity verification visible, so that a stranger cannot use the app to lure families and their children.

All three survey pain points (events #1, travel #2, routine and childcare #3) depend on it: none of these modules can safely exist without trusted accounts. It directly unlocks pain point #1, since hosting an event is the first capability that requires verification.

**Mental load check.** Accounts add friction by nature, so this spec keeps it low: sign-up asks only what is needed to start, verification is *just in time* (asked only when a parent wants to host, never to join), and parents stay signed in on their phone. Verification badges *reduce* mental load for everyone else: parents no longer have to judge alone whether a stranger is who they claim to be.

## 2. Target users and context

| User | Who | When and where |
|---|---|---|
| **Parent** | Mother, father or guardian of young children, 25 to 45, already tired (84% feel tired "sometimes" or "often"). | Signs up in 2 minutes on their phone, in a spare moment (commute, evening on the sofa). Verifies identity later, the day they want to host their first picnic or snack gathering. |
| **Admin** | SPARKCIRCLES team member (initially the PM). | Works in a separate web back office, not in the mobile app: reviewing identity documents needs a large screen, and keeping admin powers out of the app parents carry everywhere limits the damage if a phone is lost or stolen. Reviews pending verifications from a desk, a few times a day; handles user requests (data copy, closure issues). Has access to the most sensitive data in the system, so every access is traced. |

## 3. Success metrics

1. **Sign-up completion**: at least 70% of people who start sign-up reach a confirmed account, with a median sign-up time under 2 minutes (first screen to email confirmed).
2. **Verification turnaround**: median time from submission to admin decision under 48 hours; at least 60% of parents who start a verification complete it.
3. **Trust guardrail (must always hold)**: 100% of event hosts hold a valid verification at the time they create an event, and a quarterly check finds zero sensitive fields readable in plain text in the database or its backups.

## 4. User stories

- **US-1** As a parent, I want to create an account with my email and a password, so that I can start using SPARKCIRCLES in a couple of minutes.
- **US-2** As a parent, I want to confirm my email address, so that the app can reach me and nobody can register with my address.
- **US-3** As a parent, I want to log in and stay logged in on my phone, and log out when I choose, so that I don't have to type my password every morning.
- **US-4** As a parent, I want to reset my password when I forget it, so that I never lose access to my family's organization.
- **US-5** As a parent, I want to understand and accept how my data is used, and choose separately whether I receive marketing messages, so that I stay in control of my privacy.
- **US-6** As a parent, I want to know exactly what other members can see about me, so that I share only what I am comfortable with.
- **US-7** As a parent, I want to verify my identity when I decide to host an event, so that other families can trust me and my events.
- **US-8** As a parent meeting other families, I want to see whether a person is verified before I act, and hosts want to be able to limit some activities to verified people, so that I can protect my children from strangers with bad intentions.
- **US-9** As an admin, I want to review pending identity verifications and approve or reject them with a reason, so that only real, identified people get the verified badge.
- **US-10** As a SPARKCIRCLES user, I want my sensitive personal data to be encrypted by the app and accessed only when strictly needed, so that a leak or hack exposes as little as possible about me and my family.
- **US-11** As a parent, I want to close my account and have my personal data erased, so that I can leave SPARKCIRCLES without leaving my identity behind.
- **US-12** As a parent, I want to get a copy of my personal data, so that I can see what the app holds about me (GDPR right of access and portability).
- **US-13** As a parent, I want to change the email address of my account safely, so that I keep receiving SPARKCIRCLES messages when my address changes, and nobody can take over my account by changing it without my knowledge.

## 5. Acceptance criteria

### US-1: Sign up

- **AC-1.1** Given a person on the sign-up screen, when they enter a first name, last name, email and password, confirm they are 18 or older, accept the terms and privacy policy, and submit, then an account is created in "email not confirmed" state and a confirmation email is sent.
- **AC-1.2** Given the sign-up form, when the "I am 18 or older" box or the terms and privacy policy box is not ticked, then the account cannot be created and the person is told which box is missing.
- **AC-1.3** Given an email address already used by an existing account, when someone tries to sign up with it, then no second account is created, and the screen shows the same neutral message as a successful sign-up ("Check your inbox"), while the owner of the address receives an email saying someone tried to register with it. (The app never reveals whether an email is registered.)
- **AC-1.4** Given a password shorter than 10 characters, or appearing in a list of commonly breached passwords, when the person submits, then the account is not created and the message says what a valid password needs.
- **AC-1.5** Given a successful sign-up, then the new account has the role "parent" and the verification status "not verified". No other role can be chosen or obtained through sign-up (in particular, "admin" can never be self-assigned).
- **AC-1.6** Given the sign-up form, then it asks for no other personal data than those listed in AC-1.1 (no phone, address, date of birth or children data at this step).
- **AC-1.7** Given an account can hold several roles, then a role added later (e.g. "admin") is added to the same account without creating a second one, and removing a role does not delete the account.

### US-2: Email confirmation

- **AC-2.1** Given an account with an unconfirmed email, when the person opens the confirmation link within 24 hours, then the email is marked as confirmed and they land in the app, logged in.
- **AC-2.2** Given an expired or already-used confirmation link, when it is opened, then nothing changes and the person is offered to send a new link.
- **AC-2.3** Given an account with an unconfirmed email, when the person logs in, then they can only see a "Confirm your email" screen with a "Send the link again" action; they cannot join, host or contact anyone.
- **AC-2.4** Given an account whose email is still unconfirmed 7 days after sign-up, then it is permanently deleted together with all its data, and the email address can be used to sign up again.

### US-3: Login, staying logged in, logout

- **AC-3.1** Given a confirmed account, when the person enters the right email and password, then they are logged in.
- **AC-3.2** Given a wrong email or wrong password, then the message is the same in both cases ("Email or password doesn't match") and does not reveal which one is wrong.
- **AC-3.3** Given 5 failed login attempts on the same account within 15 minutes, then further attempts on that account are blocked for 15 minutes and the account owner receives an email about it.
- **AC-3.4** Given a logged-in parent who keeps using the app, then they stay logged in on that device without re-entering their password; given 30 days without any use on that device, then they must log in again.
- **AC-3.5** Given a logged-in user, when they log out, then that device can no longer access their account until they log in again, and their other devices stay logged in.
- **AC-3.6** Given a logged-in user, when they choose "Log out of all devices", then every device, including the current one, requires a new login.

### US-4: Password reset

- **AC-4.1** Given the "Forgot password" screen, when any email address is entered, then the screen always shows the same message ("If an account exists, we've sent you a link"), and an email with a reset link is sent only if the account exists.
- **AC-4.2** Given a reset link, when it is opened within 1 hour and a valid new password is set, then the password is changed, every other device is logged out, and a confirmation email is sent to the account owner.
- **AC-4.3** Given a reset link that is expired or already used, then it does not work and the person can request a new one.
- **AC-4.4** Given a logged-in user who changes their password from settings, then they must enter their current password, and all their other devices are logged out.

### US-5: Consent and privacy policy

- **AC-5.1** Given the sign-up form, then the terms and privacy policy are reachable from the form before acceptance, and the acceptance box is unticked by default.
- **AC-5.2** Given a completed sign-up, then the account keeps a record of which version of the terms and privacy policy was accepted and when.
- **AC-5.3** Given the sign-up form, then marketing communications are a separate, optional choice, unticked by default, and declining it does not block sign-up.
- **AC-5.4** Given a logged-in user, when they turn marketing communications on or off in settings, then the change applies immediately and its date is recorded.
- **AC-5.5** Given a new version of the terms or privacy policy that requires acceptance, when an existing user next opens the app, then they are shown what changed and asked to accept before continuing.

### US-6: What others can see

- **AC-6.1** Given any other member viewing a parent's profile, then they can see only: first name, initial of the last name, profile photo (if the parent added one), verification badge, and the city or neighborhood the parent chose to show.
- **AC-6.2** Given any other member, then they can never see a parent's email, phone number, full last name, exact address, date of birth, identity document, selfie or verification details through the app or the API.
- **AC-6.3** Given a logged-in parent, when they open "How others see me", then they see a preview of their profile exactly as other members see it.
- **AC-6.4** Given a request to the API for another user's profile, then the response contains only the fields listed in AC-6.1, whatever the requester's role (except admins, as defined in US-9 and US-10).

### US-7: Parent identity verification (required to host)

Verification statuses: **not verified**, **pending**, **verified**, **rejected**, **expired**.

- **AC-7.1** Given a parent whose status is anything other than "verified", when they try to host (create) an event, then the event is not created and they are invited to verify their identity, with an explanation of why ("Verified hosts keep children safe").
- **AC-7.2** Given a parent who is not verified, then they can use everything that does not require verification (browse, join events that are open to all, view profiles) without being asked to verify. Joining an event never requires verification by default.
- **AC-7.3** Given a parent starting verification, when they submit a photo of one valid government-issued document (passport, national ID card, driving licence, *titre de séjour*, or another government-issued residence card; front and back when the document has two sides), a selfie, and their date of birth, then their status becomes "pending" and they are told the expected review time ("Usually within 48 hours").
- **AC-7.4** Given a document whose printed expiry date has already passed, then it is not accepted (the parent is told before submitting when possible, otherwise the admin rejects it with that reason).
- **AC-7.5** Given a parent with status "pending", then they still cannot host events, they see their status and the expected review time, and they cannot submit a second verification at the same time.
- **AC-7.6** Given an admin approves the verification, then the parent's status becomes "verified", the verification expiry date is recorded (see AC-7.11), they receive a notification and an email, and they can host events immediately.
- **AC-7.7** Given an admin rejects the verification, then the parent's status becomes "rejected", they receive the reason in plain words and what to do next (e.g. "The photo is blurry, take a new one in good light"), and they can submit again.
- **AC-7.8** Given a verified parent who changes their first or last name, then their status goes back to "not verified" and they must verify again before hosting new events.
- **AC-7.9** Given an admin revokes a verification (e.g. after a safety report), then the status becomes "not verified", the parent is informed with the reason, and they cannot host new events.
- **AC-7.10** Given a decision (approved or rejected) on a verification, then the document images and the selfie are permanently erased no later than 30 days after the decision (kept until then only so an admin can double-check a decision; every access is logged per US-10), and only the outcome, the document type, the document's expiry date, the decision date and the reviewing admin are kept.
- **AC-7.11** Given an approved verification, then it expires on the expiry date printed on the document used, or 2 years after approval, whichever comes first (confirmed by the PM: shorter than usual because the app concerns children's safety).
- **AC-7.12** Given a verified parent, when their verification is 30 days and then 7 days from expiry, then they receive a reminder inviting them to verify again with a valid document.
- **AC-7.13** Given a verification that reaches its expiry date, then the status becomes "expired", the parent can no longer host new events or access anything restricted to verified users, and other members see them as not verified until a new verification is approved.
- **AC-7.14** Given these rules, then they are enforced by the backend: a parent without a valid verification cannot create an event even by calling the API directly.

### US-8: Verification status is visible and usable to restrict access

- **AC-8.1** Given any place where a parent is shown to other members in relation to an event, a home or children (profile, event host, event participant list, community member list), then their verification badge is visible before any call to action (join, contact, propose).
- **AC-8.2** Given a parent who is not verified (including pending, rejected or expired), then other members see a neutral "Not verified" status, not a blank, and never the reason (pending, rejected, expired stay private).
- **AC-8.3** Given the "Verified" badge, when a member taps it, then they see what it means and what it does not mean: "Identity checked by SPARKCIRCLES. This is not a criminal record check."
- **AC-8.4** Given any feature that restricts an action to verified users (first user: an event the host set as "verified users only", Events feature), when a user without a valid verification attempts that action, then the backend refuses it, even through a direct API call, and the user is told they need to verify their identity to take part.
- **AC-8.5** Given a user whose verification expires or is revoked, then from that moment they are treated as not verified by every restricted action (AC-8.4), without waiting for them to log out or reopen the app.

### US-9: Admin review of verifications

All admin functions in this spec (verification queue, revocation, admin role management, sensitive data access, user requests) live in a separate web back office (AC-9.7).

- **AC-9.1** Given an admin, when they open the verification queue, then they see pending verifications, oldest first, with the time each has been waiting.
- **AC-9.2** Given a pending verification, when an admin opens it, then they see the submitted document, the selfie, the date of birth and the name on the account, record the document's expiry date, and can approve, or reject with a reason chosen from a list (plus an optional free-text note).
- **AC-9.3** Given an admin, then they cannot review, approve or reject their own verification.
- **AC-9.4** Given a non-admin user, when they try to reach any admin function or admin data (in the app or through the API), then access is refused (mobile app, back office or API).
- **AC-9.5** Given an admin account, then logging in to the back office requires a second factor in addition to the password.
- **AC-9.6** Given admin accounts, then there is a single admin role; the role can only be given or removed by an existing admin, and each change is recorded in the audit log.
- **AC-9.7** Given an admin, then every admin function is available only in the separate web back office; the mobile app contains no admin function or admin data, even when an admin logs in to it (an admin who is also a parent uses the mobile app as a parent only).

### US-10: Encryption and protected access to sensitive data

**Sensitive data** in v1 means: email, phone (if added later), full last name, date of birth, address and neighborhood, identity document images and their extracted details (including the document's expiry date), selfie, verification notes, and IP addresses kept in security logs. Children's data, when added by another spec, is also sensitive.

- **AC-10.1** Given a copy of the production database or any of its backups, then none of the sensitive fields above can be read in plain text, and passwords are never stored in a recoverable form.
- **AC-10.2** Given the stored identity documents and selfies (files), then they cannot be viewed by someone who obtains the storage files without going through the app.
- **AC-10.3** Given someone who obtains a database backup only, then that is not enough to decrypt the sensitive fields (the means to decrypt are not stored in the same place as the data or its backups).
- **AC-10.4** Given an admin views an identity document, a selfie, or any user's sensitive data, then an audit entry records who, which user's data, what was viewed, when, and the reason (e.g. "Verification review", "User request").
- **AC-10.5** Given the audit log, then no admin can edit or delete entries, and entries are kept for at least 1 year.
- **AC-10.6** Given any user, then sensitive data never appears in application logs, error reports, analytics events or URLs.
- **AC-10.7** Given any connection between the mobile app or the web back office and the backend, then it is encrypted in transit.

### US-11: Close my account and erase my personal data

- **AC-11.1** Given a logged-in parent, when they choose "Close my account", then they see in plain words what will happen (profile hidden at once, personal data erased after 30 days, closure can be cancelled until then, old data can never be recovered afterwards) and must confirm by entering their password.
- **AC-11.2** Given a confirmed closure, then the user is logged out of all devices, other members can no longer see the profile, marketing communications stop, and the user receives an email confirming the closure and the date of erasure.
- **AC-11.3** Given a closure less than 30 days old, when the person logs in with their email and password, then they are offered to cancel the closure; if they cancel, the account is restored as it was. (30-day grace period confirmed by the PM.)
- **AC-11.4** Given a closure that reaches 30 days, then all personal data of the account is permanently erased or made unrecoverable (destroying the account's encryption key is acceptable), including in backups, so that no one, admins included, can read it again.
- **AC-11.5** Given an erased account, then the only data kept are: (a) data a specific legal obligation requires, listed in a retention register with its legal basis and duration, encrypted, accessible only to admins with audited access, and erased at the end of that duration; and (b) non-identifying statistical records of past activity.
- **AC-11.6** Given the statistical records kept after erasure, then none of them, alone or combined with any other data SPARKCIRCLES holds, allows identifying the person: they contain no name, email, photo, phone, date of birth, IP address, device identifier, exact address or free text written by the person, and any internal identifier they carry is no longer linked to any retained personal data.
- **AC-11.7** Given shared history the person took part in (past events, community activity), then after closure they appear as "Former member", with no name or photo.
- **AC-11.8** Given an erased account's email address, when someone signs up with it, then a brand-new account is created, with "not verified" status and none of the old data, which cannot be recovered.
- **AC-11.9** Given a parent hosting upcoming events, when they close their account, then they are told before confirming that those events will be cancelled and participants notified (rule applied by the Events feature).

### US-12: Copy of my data

- **AC-12.1** Given a logged-in user, when they request a copy of their data from settings, then they receive, within 30 days at most (target: 48 hours), a downloadable file in a common machine-readable format containing their account data, profile, consents, their history, and the verification outcome.
- **AC-12.2** Given the download link, then it works only for the account owner after logging in, and expires after 7 days.
- **AC-12.3** Given a data copy request, then it is recorded (date requested, date delivered).

### US-13: Change my email address

- **AC-13.1** Given a logged-in user, when they ask to change their email address, then they must enter their current password; with a wrong password, nothing changes and no email is sent.
- **AC-13.2** Given a correct password and a new address, then a confirmation link is sent to the new address, the account's email stays the old one (login still uses the old address), and the user is told to open the link sent to the new address.
- **AC-13.3** Given a confirmation link for an email change, when it is opened within 24 hours, then the account's email becomes the new address and the user receives a confirmation at the new address; given an expired or already-used link, then nothing changes and the user can request a new link (same rules as AC-2.1 and AC-2.2).
- **AC-13.4** Given a user who requests another email change while one is pending, then only the latest link works; earlier links no longer change anything.
- **AC-13.5** Given a new address already used by another account, when the change is requested, then the screen shows the same neutral message as for a free address (the app never reveals whether an email is registered), no change can happen, and the owner of that address receives an email saying someone tried to use it (same rule as AC-1.3).
- **AC-13.6** Given a confirmation link whose new address has been taken by another account in the meantime, when it is opened, then the change is refused and the account keeps its current email.
- **AC-13.7** Given an email change that takes effect, then the old address receives a notice with the date of the change and a "This wasn't me" link, valid for 30 days, that works without logging in.
- **AC-13.8** Given a "This wasn't me" report, then the account is secured at once: every device is logged out, the account is locked, the report appears to admins in the back office, and an audit entry is recorded; after checking, an admin can restore the previous email address, and the owner then sets a new password through a reset link sent to that address.
- **AC-13.9** Given an email change that takes effect, then every other device of the user is logged out, and the verification status does not change (only a name change resets it, AC-7.8).

## 6. Out of scope

All items below are tracked in [`docs/backlog.md`](../backlog.md).

- Service-provider accounts and business verification (ID, SIRET, VAT); the "provider" role.
- Paid plans or subscriptions.
- External automated identity verification (free or open-source service).
- The per-event "verified users only" option and event hosting screens (Events feature; this spec only provides the verification status and the rule of AC-8.4).
- Public family-friendly events from open-data APIs.
- Additional admin or support roles.
- Launch outside France and outside the EU.
- Criminal record or background checks: not done; the app must never suggest otherwise (AC-8.3).
- Social login (Apple, Google), passkeys, two-factor authentication for parents.
- Reporting and blocking members (trust and safety), strongly recommended right after v1.
- Family profile and children data.
- Profile photo upload: in v1 the avatar shows the person's initials (AC-6.1 applies once photos exist).
- Screen layouts and the admin interface design (designer). Encryption, token and storage choices (developer).

## 7. Dependencies and risks

### Data stored and who may see or change it (enforced by the backend)

| Data | Owner sees / edits | Other members see | Admin sees | Encrypted at app level |
|---|---|---|---|---|
| First name, last-name initial, photo | Yes / yes | Yes | Yes | No (public profile data) |
| Full last name, email, date of birth | Yes / yes (name change resets verification; email change confirmed through the new address, US-13) | Never | Yes, audited | Yes |
| City or neighborhood shown | Yes / yes | Yes (only what the user chose) | Yes | Yes |
| Roles (parent, admin) | Yes / no | No | Yes / admin role only by an admin | No |
| Verification status, expiry date | Yes / no | Only "Verified" or "Not verified" | Yes / approve, reject, revoke | Status no; expiry date yes |
| Document images, selfie, extracted details | Submits only, cannot view after | Never | Yes, audited, until erasure (AC-7.10) | Yes |
| Consent records, marketing choice | Yes / marketing choice only | Never | Yes | No |
| Security logs (logins, IP addresses) | Not in v1 | Never | Yes, audited | IP addresses yes |
| Admin audit log | Never | Never | Read only, nobody can edit | No |
| Statistical records after erasure | — | Never | Yes (aggregated analysis) | Must not identify anyone (AC-11.6) |

### Other modules

- **Events**: must refuse event creation by parents without a valid verification (AC-7.1, AC-7.14), offer the host the "verified users only" option and enforce it through AC-8.4, show host and participant badges (AC-8.1), and handle hosted events when an account closes (AC-11.9). Open point for the Events spec: what happens to a host's upcoming events when their verification expires (AC-7.13).
- **Community, Travel, future Market**: will reuse the verification status, the visibility rules (US-6, US-8) and the restriction rule (AC-8.4).
- **Family profile** (future spec): children data is sensitive and must follow US-10 and US-11.
- **Web back office**: admins need a separate web back office (AC-9.7), distinct from the mobile app, for verification review, revocation, admin roles, "This wasn't me" reports (AC-13.8) and user requests. Its layout belongs to the designer; its technology to the developer.
- **Notifications and email**: sign-up, confirmation, reset, email change (new and old address), verification decision, expiry reminders and closure emails need an email provider (a GDPR data processor).

### Trust and safety (children, homes, strangers)

- **Main threat the PM named**: a predator creating an account to host events and lure families with children. Mitigations in v1: valid verification required to host (US-7), badge always visible (US-8), hosts can restrict events to verified users (AC-8.4), revocation and expiry (AC-7.9, AC-7.13). Residual risks: a verified person can still behave badly; there is no reporting or blocking yet. **A "report a member" feature should follow v1 quickly.**
- **Joining is open by default.** An unverified person can attend events open to all, where children are present. The host's "verified users only" choice is the safeguard; the Events spec should make it easy to find at event creation.
- **"Verified" can create false confidence.** It means identity checked, not "safe with children". AC-8.3 states it explicitly; marketing must use the same wording.
- **Manual review** depends on admin availability; long queues frustrate hosts. Admins must be trained to spot forged documents and photo mismatches; manual review is weaker than a specialized service against good forgeries. The wider list of accepted documents (driving licence, residence cards) increases the variety of documents admins must recognize.
- **Fake or duplicate accounts**: someone rejected could sign up again with another email (backlog).

### GDPR and privacy risks (not legal advice; to confirm with the GDPR advisor)

- **Erasure on closure (replaces "encrypt, don't delete").** The PM and the GDPR advisor agree that encrypting data while the platform keeps the key is not erasure. v1 therefore erases personal data at the end of a 30-day grace period (crypto-shredding acceptable), including from backups (AC-11.4).
- **Anonymous vs pseudonymous statistics.** A retained internal ID that is still linked to activity records is **pseudonymous**, which is still personal data under GDPR, unless nothing SPARKCIRCLES holds can link it back to the person. AC-11.6 sets that requirement. Re-identification can also happen indirectly (e.g. the only host of events in a small village, rare combinations of dates and places), so statistics should be coarse enough (aggregated, rounded dates, wide areas) to stay anonymous. The advisor should validate the approach.
- **Data kept for legal reasons.** Only what a specific legal obligation requires, listed in a retention register (AC-11.5). Example to check with the advisor: French rules may require online services to keep some identification or connection data of people who publish content (such as event hosts) for a limited period. The app must not keep anything "just in case".
- **Audit log vs erasure.** Audit entries (kept at least 1 year) refer to users. After erasure they must not allow re-identifying the person beyond what a legal obligation justifies; the advisor should confirm how they are handled.
- **Identity documents are high-risk data.** Images are erased within 30 days of the decision (AC-7.10), kept until then only for double-checking a decision. Large-scale processing of ID documents in a service involving children likely requires a **Data Protection Impact Assessment (DPIA, Art. 35)** before launch.
- **Launch prerequisites outside the app** (PM with legal help): terms of use, privacy policy, record of processing activities, retention register, data processing agreements with every processor (EU hosting, email), and a breach procedure (notification to the CNIL within 72 hours when required).
- **Admin access**: least privilege, second factor, full audit log, admin functions only in the web back office (US-9, US-10). With a single admin role, every admin can see ID documents, so the group should stay very small.
- **Rights of users**: access and portability (US-12), rectification (profile edit, AC-7.8; email change, US-13), erasure (US-11), objection to marketing (AC-5.4). The legal deadline to answer is one month.

## 8. Open questions

None. All questions answered by the PM on 2026-10-02.

## 9. Priority

| Stories | Priority | Rationale |
|---|---|---|
| US-1 to US-11 | **Must** | No module can launch without secure accounts, visible verification, legal erasure and GDPR-grade protection; hosting events (pain point #1) depends on it. |
| US-13 (email change) | **Must** | Basic account management and the GDPR right to rectification; without it, a parent who changes address loses access to reset and safety emails. |
| US-12 (data copy) | **Should** | A legal right with a one-month deadline; it can be handled manually by an admin at first if the automated export slips. |
