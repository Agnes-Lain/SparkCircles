import type { ApiClient } from './client';
import type { Pagination } from './events';

// Circles v1 (docs/api/circles.md). Types written by hand from the contract, section
// numbers in comments. The audience (public, member) is decided by the server.

type Client = Pick<ApiClient, 'request'>;

export type CircleVisibility = 'public' | 'private';
export type CircleRole = 'admin' | 'co_admin' | 'member';
export type Area = { key: string; label: string };

/** §2.1 / §2.2 The viewer's own status (AC-17.13). */
export type CircleViewer = {
  status: 'none' | 'pending' | 'member';
  can_request: boolean;
  request_blocker: 'account_required' | 'full' | 'member_limit' | 'pending' | 'member' | null;
};

/** §2.1 What non-members and guests see of a discoverable circle (AC-17.5). */
export type PublicCircle = {
  id: string;
  audience: 'public';
  name: string;
  description: string | null;
  area: Area;
  visibility: 'public';
  families_count: number;
  max_families: number;
  full: boolean;
  run_by_verified_parent: true;
  viewer: CircleViewer;
};

/** §2.2 An invitation link or code (AC-3.1); no id, description or members. */
export type InvitationPreview = {
  name: string;
  area: Area;
  visibility: CircleVisibility;
  families_count: number;
  max_families: number;
  full: boolean;
  /** Logged-in people only (guests: null, design 4e). */
  admin: { first_name: string; last_name_initial: string; verified: boolean } | null;
  viewer: CircleViewer;
};

export type CircleMember = {
  id: string;
  first_name: string;
  last_name_initial: string;
  photo_url: string | null;
  verified: boolean;
  city_shown: string | null;
  role: CircleRole;
  creator: boolean;
  me: boolean;
};

export type CircleRequest = {
  id: string;
  first_name: string;
  last_name_initial: string;
  verified: boolean;
  requested_at: string | null;
  expires_at: string | null;
};

export type CircleEventSummary = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  area: Area;
};

/** §2.3 The circle as its members see it. */
export type MemberCircle = {
  id: string;
  audience: 'member';
  status: 'active';
  name: string;
  description: string | null;
  area: Area;
  visibility: CircleVisibility;
  premium_entitlement: 'test_phase_free' | null;
  /** Forced to private by SparkCircles: the admins can't make it public until staff lift it. */
  forced_private: boolean;
  families_count: number;
  max_families: number;
  full: boolean;
  created_at: string;
  my_role: CircleRole;
  creator: boolean;
  admin_rights_paused: boolean;
  discoverable: boolean;
  accepting_requests: boolean;
  next_event: CircleEventSummary | null;
  events: (CircleEventSummary & {
    joined: boolean;
    host: { first_name: string; last_name_initial: string; verified: boolean };
  })[];
  members: CircleMember[];
  requests: CircleRequest[];
  can: {
    manage: boolean;
    invite: boolean;
    edit: boolean;
    delete: boolean;
    leave: boolean;
    step_down: boolean;
    promote: boolean;
  };
};

/** §2.5 A paused or closed circle shows its members nothing else. */
export type ClosedCircle = { id: string; audience: 'member'; status: 'suspended' | 'closed' };

export type CircleDetail = MemberCircle | ClosedCircle | PublicCircle;

/** §3 GET /circles items. */
export type MyCircleItem =
  | {
      id: string;
      state: 'member';
      circle: {
        id: string;
        name: string;
        area: Area;
        visibility: CircleVisibility;
        families_count: number;
        my_role: CircleRole;
        requests_count: number;
        next_event: { id: string; starts_at: string; time_zone: string } | null;
        new: boolean;
        members_preview: { first_name: string; last_name_initial: string; seed: string }[];
      };
    }
  | {
      id: string;
      state: 'pending' | 'expired';
      circle: { id?: string | null; name: string; area: Area; families_count: number };
    }
  /** PM phone test 2026-10-07: my declined request, the circle name only. */
  | { id: string; state: 'declined'; circle: { name: string } }
  | { id: string; state: 'removed' | 'paused' | 'closed'; circle: null };

export type CircleLimits = {
  created: number;
  max_created: number;
  circles: number;
  max_circles: number;
  can_create: boolean;
};

export type MyCircles = { items: MyCircleItem[]; limits: CircleLimits };

export type CircleParams = {
  name?: string;
  description?: string;
  area?: string;
  visibility?: CircleVisibility;
};

export type Invitation = {
  link: string;
  code: string;
  enabled: boolean;
  renewed_at: string;
  full: boolean;
};

/** A link token or a typed code (dashes, spaces and case ignored by the API). */
export type InvitationKey = { token: string } | { code: string };

export type CircleSearch = { area?: string[]; q?: string; near?: string };
export type CirclePage = { circles: PublicCircle[]; pagination: Pagination };

export type CircleReportReason =
  | 'unsafe'
  | 'not_real_group'
  | 'inappropriate_behaviour'
  | 'child_safety'
  | 'fake_identity'
  | 'other';

export const CIRCLE_REASONS: CircleReportReason[] = ['unsafe', 'not_real_group', 'other'];
export const MEMBER_REASONS: CircleReportReason[] = [
  'inappropriate_behaviour',
  'child_safety',
  'fake_identity',
  'other',
];

/** React Query keys: everything about circles starts with `circles`. */
export const CIRCLES_KEY = ['circles'] as const;
export const MY_CIRCLES_KEY = ['circles', 'mine'] as const;
export const circleKey = (id: string) => ['circles', 'detail', id] as const;
export const invitationKey = (id: string) => ['circles', 'invitation', id] as const;
export const circleSearchKey = (search: CircleSearch) => ['circles', 'search', search] as const;
export const previewKey = (key: InvitationKey) => ['circles', 'preview', key] as const;

/** The query string of GET /circles/search, without empty values. */
export function circleSearchQuery(search: CircleSearch, page: number): string {
  const params: [string, string][] = [];
  const areas = search.area ?? [];
  if (areas.length === 0) params.push(['area', 'paris']);
  else if (areas.length === 1) params.push(['area', areas[0]!]);
  else areas.forEach((key) => params.push(['area[]', key]));
  if (search.q) params.push(['q', search.q]);
  if (search.near) params.push(['near', search.near]);
  params.push(['page', String(page)]);
  return params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

const path = (id: string) => `/circles/${encodeURIComponent(id)}`;

export function circlesApi(client: Client) {
  return {
    /** §3 GET /circles */
    mine: (signal?: AbortSignal) => client.request<MyCircles>('/circles', { signal }),
    /** §3 GET /circles/:id (member view, or the public page) */
    get: (id: string, signal?: AbortSignal) =>
      client.request<{ circle: CircleDetail }>(path(id), { signal }),
    /** §3 POST /circles */
    create: (circle: CircleParams) =>
      client.request<{ circle: MemberCircle }>('/circles', { method: 'POST', body: { circle } }),
    /** §3 PATCH /circles/:id */
    update: (id: string, circle: CircleParams) =>
      client.request<{ circle: MemberCircle }>(path(id), { method: 'PATCH', body: { circle } }),
    /** §3 DELETE /circles/:id */
    remove: (id: string) => client.request<void>(path(id), { method: 'DELETE' }),
    /** §3 GET /circles/search */
    search: (search: CircleSearch, page: number, signal?: AbortSignal) =>
      client.request<CirclePage>(`/circles/search?${circleSearchQuery(search, page)}`, { signal }),
    /** §3 Invitations (admins) */
    invitation: (id: string, signal?: AbortSignal) =>
      client.request<{ invitation: Invitation }>(`${path(id)}/invitation`, { signal }),
    renewInvitation: (id: string) =>
      client.request<{ invitation: Invitation }>(`${path(id)}/invitation`, { method: 'POST' }),
    toggleInvitation: (id: string, enabled: boolean) =>
      client.request<{ invitation: Invitation }>(`${path(id)}/invitation`, {
        method: 'PATCH',
        body: { enabled },
      }),
    /** §3 POST /circle_invitations/preview (guests too) */
    preview: (key: InvitationKey) =>
      client.request<{ circle: InvitationPreview }>('/circle_invitations/preview', {
        method: 'POST',
        body: key,
      }),
    /** §3 POST /circle_invitations/join */
    joinByInvitation: (key: InvitationKey) =>
      client.request<{ request: { status: 'pending' } }>('/circle_invitations/join', {
        method: 'POST',
        body: key,
      }),
    /** §3 POST /circles/:id/join_request (public page) */
    askToJoin: (id: string) =>
      client.request<{ request: { status: 'pending' } }>(`${path(id)}/join_request`, {
        method: 'POST',
      }),
    /** §3 DELETE /circles/:id/join_request */
    cancelRequest: (id: string) =>
      client.request<void>(`${path(id)}/join_request`, { method: 'DELETE' }),
    accept: (id: string, requestId: string) =>
      client.request<{ circle: MemberCircle }>(
        `${path(id)}/requests/${encodeURIComponent(requestId)}/accept`,
        { method: 'POST' },
      ),
    decline: (id: string, requestId: string) =>
      client.request<{ circle: MemberCircle }>(
        `${path(id)}/requests/${encodeURIComponent(requestId)}/decline`,
        { method: 'POST' },
      ),
    leave: (id: string) => client.request<void>(`${path(id)}/membership`, { method: 'DELETE' }),
    stepDown: (id: string) =>
      client.request<{ circle: MemberCircle }>(`${path(id)}/membership/step_down`, {
        method: 'POST',
      }),
    removeMember: (id: string, memberId: string) =>
      client.request<{ circle: MemberCircle }>(
        `${path(id)}/members/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' },
      ),
    promote: (id: string, memberId: string) =>
      client.request<{ circle: MemberCircle }>(
        `${path(id)}/members/${encodeURIComponent(memberId)}/promote`,
        { method: 'POST' },
      ),
    report: (id: string, reason: CircleReportReason, details?: string, memberId?: string) =>
      client.request<{ report: { id: string; created_at: string } }>(`${path(id)}/reports`, {
        method: 'POST',
        body: {
          reason,
          ...(details ? { details } : {}),
          ...(memberId ? { member_id: memberId } : {}),
        },
      }),
    /** §3 POST /circle_cards/:id/dismiss (« Masquer ») */
    dismissCard: (itemId: string) =>
      client.request<void>(`/circle_cards/${encodeURIComponent(itemId)}/dismiss`, {
        method: 'POST',
      }),
  };
}

export type CirclesApi = ReturnType<typeof circlesApi>;

export const isMemberCircle = (circle: CircleDetail): circle is MemberCircle =>
  circle.audience === 'member' && circle.status === 'active';
