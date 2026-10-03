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
  | 'rate_limited'
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
  | 'expired';

/** §1 Error body: { "error": { "code", "message", "details"? } } */
export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, FieldErrorKey[]>;
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
  closure: { closed_at: string; erasure_on: string } | null;
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
