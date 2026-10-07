// Types for the SparkCircles JSON API, written by hand from the API contract
// docs/api/accounts-and-verification.md (section numbers in comments). Keep them in sync:
// a contract change means a change here and in the fixtures of src/test/fixtures.ts.

/** §1 Errors: every error code the API can return, plus two client-side codes. */
export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'closure_pending'
  | 'terms_acceptance_required'
  | 'forbidden'
  | 'verification_required'
  | 'not_found'
  | 'verification_pending'
  | 'email_taken'
  | 'validation_failed'
  | 'invalid_or_expired_token'
  | 'invalid_password'
  | 'account_locked'
  // D-8: locked by a "This wasn't me" report; only the team unlocks it.
  | 'account_secured'
  | 'rate_limited'
  // Events contract (docs/api/events.md, section 1).
  | 'client_not_allowed'
  | 'client_blocked'
  | 'event_not_editable'
  | 'event_not_draft'
  | 'event_not_joinable'
  | 'own_event'
  | 'already_joined'
  | 'not_joined'
  | 'not_enough_places'
  | 'event_started'
  | 'already_reported'
  | 'search_too_broad'
  // US-17 requests (docs/api/events.md, section 8).
  | 'already_requested'
  | 'request_declined'
  | 'request_not_pending'
  | 'request_expired'
  | 'request_closed'
  | 'requests_frozen'
  // Circles contract (docs/api/circles.md, section 1).
  | 'admin_rights_paused'
  | 'circle_create_limit'
  | 'circle_member_limit'
  | 'circle_full'
  | 'already_member'
  | 'sole_admin'
  | 'admin_limit'
  | 'already_admin'
  | 'member_is_admin'
  | 'member_is_creator'
  | 'not_verified_member'
  | 'circle_has_verified_members'
  | 'requester_at_limit'
  | 'invitation_invalid'
  | 'too_many_tries'
  // QA fixes: paused or closed circle (B2), forced private by SparkCircles (B3).
  | 'circle_paused'
  | 'circle_closed'
  | 'circle_forced_private'
  | 'server_error'
  // Client side: no answer from the server (offline, DNS, refused) or too slow.
  | 'network_error'
  | 'timeout'
  // Client side: the server answered with something that isn't the documented error shape.
  | 'unexpected_response';

/** §1 Field error keys used in `details` of `validation_failed`. */
export type FieldErrorKey =
  | 'blank'
  | 'invalid'
  | 'too_short'
  | 'too_common'
  | 'must_be_accepted'
  | 'same_as_current'
  | 'too_large'
  | 'invalid_type'
  | 'expired'
  // Events contract (docs/api/events.md, section 1).
  | 'not_an_integer'
  | 'too_long'
  | 'inclusion'
  | 'in_past'
  | 'before_start'
  | 'too_long_duration'
  | 'out_of_range'
  | 'below_taken'
  | 'invalid_range'
  | 'not_editable'
  | 'too_many'
  | 'invalid_characters'
  | 'contains_email'
  | 'contains_phone'
  | 'contains_link'
  | 'contains_handle'
  | 'contains_address'
  | 'banned_word'
  | 'too_few'
  | 'too_far'
  // Circles (docs/api/circles.md): events with circles.
  | 'not_allowed';

/** §1 Error body: { "error": { "code", "message", "details"? } } */
export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, FieldErrorKey[]>;
    /** Events: `not_enough_places` says how many places are left. */
    places_left?: number;
  };
};

/** §1 Account gates (403), checked in this order. */
export type AccountGate = 'email_not_confirmed' | 'closure_pending' | 'terms_acceptance_required';

/** §2 Verification statuses (AC-7.x). */
export type VerificationStatus = 'not_verified' | 'pending' | 'verified' | 'rejected' | 'expired';

export type RejectionReason =
  | 'photo_blurry'
  | 'document_cut_off'
  | 'document_expired'
  | 'document_not_accepted'
  | 'selfie_mismatch'
  | 'name_mismatch'
  | 'safety_report'
  | 'other';

export type Rejection = { reason: RejectionReason; message: string; note: string | null };

/** §2 `verification` object of `me`. */
export type Verification = {
  status: VerificationStatus;
  verified: boolean;
  expires_on: string | null;
  expires_soon: boolean;
  revoked: boolean;
  submitted_at: string | null;
  rejection: Rejection | null;
  renewal: {
    status: 'pending' | 'rejected';
    submitted_at: string;
    rejection: Rejection | null;
  } | null;
};

/** §2 The `me` object, only ever returned to its owner. */
export type Me = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  pending_email: string | null;
  city_shown: string | null;
  locale: 'fr' | 'en';
  roles: string[];
  email_confirmed: boolean;
  terms_acceptance_required: boolean;
  closure: Closure | null;
  marketing_opt_in: boolean;
  marketing_opt_in_changed_at: string | null;
  consents: {
    terms_version: string;
    terms_accepted_at: string;
    privacy_version: string;
    privacy_accepted_at: string;
  };
  verification: Verification;
};

/** §5 Public profile, exactly what other members see (AC-6.1, 6.4). */
export type PublicProfile = {
  id: string;
  first_name: string;
  last_name_initial: string;
  photo_url: string | null;
  verified: boolean;
  city_shown: string | null;
};

/** §4 Endpoints that log a device in answer { token, user }. */
export type SessionResponse = { token: string; user: Me };

/** §3 `POST /registrations` body (AC-1.1–1.6, 5.1–5.3). */
export type RegistrationParams = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  adult_confirmed: boolean;
  terms_accepted: boolean;
  marketing_opt_in: boolean;
  locale: 'fr' | 'en';
};

/**
 * §3 `POST /email_confirmations`: a sign-up link logs the device in ({ token, user });
 * an email-change link answers { token: null, user: me | null }.
 */
export type EmailConfirmationResponse = SessionResponse | { token: null; user: Me | null };

/** §5 `GET /legal` (AC-5.1, 5.5). */
export type Legal = {
  terms: { version: string; url: string };
  privacy: { version: string; url: string };
  requires_acceptance: boolean;
  changes: string[];
};

/** §2 / §7 Closure during the 30-day grace period (AC-11.1–11.3). */
export type Closure = { closed_at: string; erasure_on: string };

/** §5 `PATCH /me` body (AC-6.1, 7.8). */
export type ProfileParams = {
  first_name?: string;
  last_name?: string;
  city_shown?: string | null;
  locale?: 'fr' | 'en';
};

/** §8 Copy of my data (AC-12.1–12.3). */
export type DataExport = {
  status: 'pending' | 'ready' | 'expired';
  requested_at: string;
  delivered_at?: string | null;
  expires_at?: string | null;
};
