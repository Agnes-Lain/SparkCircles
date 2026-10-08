import type { InvitationPreview, MemberCircle, MyCircles, PublicCircle } from '../api/circles';

// Circle fixtures shaped like docs/api/circles.md section 2.

const area = { key: 'paris-11', label: 'Paris 11e' };

export const adminCircle: MemberCircle = {
  id: 'c1c1c1c1-0000-4000-8000-000000000001',
  audience: 'member',
  status: 'active',
  name: 'Parents CE2 · Jaurès',
  description: 'Les familles de la classe de Mme Roux.',
  area,
  visibility: 'public',
  premium_entitlement: null,
  forced_private: false,
  families_count: 3,
  max_families: 25,
  full: false,
  created_at: '2026-10-01T10:00:00Z',
  my_role: 'admin',
  creator: true,
  admin_rights_paused: false,
  has_verified_admin: true,
  discoverable: true,
  accepting_requests: true,
  next_event: null,
  events: [],
  members: [
    {
      id: 'm-claire',
      first_name: 'Claire',
      last_name_initial: 'M',
      photo_url: null,
      verified: true,
      city_shown: null,
      role: 'admin',
      creator: true,
      me: true,
    },
    {
      id: 'm-lea',
      first_name: 'Léa',
      last_name_initial: 'P',
      photo_url: null,
      verified: true,
      city_shown: 'Paris 11e',
      role: 'member',
      creator: false,
      me: false,
    },
    {
      id: 'm-amir',
      first_name: 'Amir',
      last_name_initial: 'K',
      photo_url: null,
      verified: false,
      city_shown: null,
      role: 'member',
      creator: false,
      me: false,
    },
  ],
  requests: [
    {
      id: 'r-ines',
      first_name: 'Inès',
      last_name_initial: 'B',
      verified: true,
      requested_at: '2026-10-06T09:00:00Z',
      expires_at: '2026-11-05T09:00:00Z',
    },
  ],
  can: {
    manage: true,
    invite: true,
    edit: true,
    delete: false,
    leave: false,
    step_down: false,
    promote: true,
  },
};

export const memberCircle: MemberCircle = {
  ...adminCircle,
  my_role: 'member',
  creator: false,
  requests: [],
  members: adminCircle.members.map((member) => ({ ...member, me: member.id === 'm-amir' })),
  events: [
    {
      id: '5b0c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3',
      title: 'Goûter et jeux au parc',
      starts_at: '2026-10-10T13:00:00Z',
      ends_at: '2026-10-10T15:00:00Z',
      time_zone: 'Europe/Paris',
      area,
      joined: true,
      host: { first_name: 'Claire', last_name_initial: 'M', verified: true },
    },
  ],
  can: {
    manage: false,
    invite: false,
    edit: false,
    delete: false,
    leave: true,
    step_down: false,
    promote: false,
  },
};
memberCircle.next_event = memberCircle.events[0]!;

export const publicCircle: PublicCircle = {
  id: adminCircle.id,
  audience: 'public',
  name: adminCircle.name,
  description: adminCircle.description,
  area,
  visibility: 'public',
  families_count: 12,
  max_families: 25,
  full: false,
  run_by_verified_parent: true,
  viewer: { status: 'none', can_request: true, request_blocker: null },
};

export const preview: InvitationPreview = {
  name: 'Voisins de la Roquette',
  area,
  visibility: 'private',
  families_count: 6,
  max_families: 25,
  full: false,
  admin: { first_name: 'Claire', last_name_initial: 'D', verified: true },
  viewer: { status: 'none', can_request: true, request_blocker: null },
};

export const myCircles: MyCircles = {
  items: [
    {
      id: 'item-1',
      state: 'member',
      circle: {
        id: adminCircle.id,
        name: adminCircle.name,
        area,
        visibility: 'public',
        families_count: 12,
        my_role: 'admin',
        requests_count: 2,
        next_event: null,
        new: false,
        members_preview: [{ first_name: 'Claire', last_name_initial: 'M', seed: 'm-claire' }],
      },
    },
    {
      id: 'item-2',
      state: 'pending',
      circle: { id: null, name: 'Voisins du square', area, families_count: 9 },
    },
    { id: 'item-3', state: 'removed', circle: null },
  ],
  limits: { created: 1, max_created: 3, circles: 2, max_circles: 5, can_create: true },
};

export const noCircles: MyCircles = {
  items: [],
  limits: { created: 0, max_created: 3, circles: 0, max_circles: 5, can_create: true },
};
