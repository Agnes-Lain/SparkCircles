import type { ApiErrorBody, Me } from '../api/types';

// Copied from docs/api/accounts-and-verification.md §2 (the `me` object) and §1 (errors).
export const meFixture: Me = {
  id: '0192a1b2-0000-7000-8000-000000000001',
  first_name: 'Claire',
  last_name: 'Martin',
  email: 'claire@example.com',
  pending_email: null,
  city_shown: 'Croix-Rousse, Lyon',
  locale: 'fr',
  roles: ['parent'],
  email_confirmed: true,
  terms_acceptance_required: false,
  closure: null,
  marketing_opt_in: false,
  marketing_opt_in_changed_at: null,
  consents: {
    terms_version: '1.0',
    terms_accepted_at: '2026-10-02T12:05:00Z',
    privacy_version: '1.0',
    privacy_accepted_at: '2026-10-02T12:05:00Z',
  },
  verification: {
    status: 'verified',
    verified: true,
    expires_on: '2028-10-02',
    expires_soon: false,
    revoked: false,
    submitted_at: '2026-10-02T12:05:00Z',
    rejection: null,
    renewal: null,
  },
};

export const validationErrorFixture: ApiErrorBody = {
  error: {
    code: 'validation_failed',
    message: 'Check the highlighted fields.',
    details: { password: ['too_short'] },
  },
};
