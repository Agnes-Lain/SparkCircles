import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { Share } from 'react-native';

import type { Me } from '../../api/types';
import { consumeReturnTo, returnHref } from '../../auth/returnTo';
import { ME_KEY } from '../../auth/useMe';
import { circleBadgeText } from '../../components/EventCard';
import i18n from '../../i18n';
import { apiError, mockAuth, mockCircles, mockEvents, resetApiMock } from '../../test/apiMock';
import {
  adminCircle,
  memberCircle,
  myCircles,
  noCircles,
  preview,
  publicCircle,
} from '../../test/circleFixtures';
import { eventFixture, eventOptionsFixture } from '../../test/eventFixtures';
import { meFixture } from '../../test/fixtures';
import { createTestQueryClient } from '../../test/render';
import { renderScreen, routeStub } from '../../test/renderScreen';
import { emptyForm, toParams, validateForm } from '../events/formModel';
import { EventFormScreen } from '../events/EventFormScreen';
import { CircleFormScreen, circleServerErrors } from './CircleFormScreen';
import { CircleScreen } from './CircleScreen';
import { CirclesScreen } from './CirclesScreen';
import { EnterCodeScreen } from './EnterCodeScreen';
import { InviteScreen } from './InviteScreen';
import { JoinPreviewScreen } from './JoinPreviewScreen';
import { ordinal } from './queries';

jest.mock('../../api', () => jest.requireActual('../../test/apiMock').apiModule);

const ROUTES = {
  community: CirclesScreen,
  'circles/new': CircleFormScreen,
  'circles/code': EnterCodeScreen,
  'circles/join': JoinPreviewScreen,
  'circles/[id]/index': CircleScreen,
  'circles/[id]/edit': CircleFormScreen,
  'circles/[id]/invite': InviteScreen,
  'join/[token]': JoinPreviewScreen,
  'events/new': EventFormScreen,
  verify: routeStub('verify'),
  'sign-up': routeStub('sign-up'),
};

const unverifiedMe: Me = {
  ...meFixture,
  verification: { ...meFixture.verification, status: 'not_verified', verified: false },
};

async function open(url: string, me: Me = meFixture) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ME_KEY, me);
  return renderScreen(ROUTES, { url, token: 'jwt', gate: 'ready', queryClient });
}

beforeEach(async () => {
  resetApiMock();
  (SecureStore as unknown as { __reset: () => void }).__reset();
  mockAuth.me.mockResolvedValue(meFixture);
  mockEvents.options.mockResolvedValue(eventOptionsFixture);
  await i18n.changeLanguage('fr');
});

describe('Cercles tab (C1)', () => {
  it('AC-9.2 lists my circles: role, families, requests to answer, pending request, neutral card', async () => {
    mockCircles.mine.mockResolvedValue(myCircles);
    await open('/community');
    const card = await screen.findByTestId(`circle-card-${adminCircle.id}`);
    expect(within(card).getByText('Parents CE2 · Jaurès')).toBeOnTheScreen();
    expect(within(card).getByText('Admin')).toBeOnTheScreen();
    expect(within(card).getByText('12 familles · Paris 11e')).toBeOnTheScreen();
    expect(within(card).getByText('2 demandes à traiter')).toBeOnTheScreen();
    expect(within(card).getByText('Cercle public')).toBeOnTheScreen();
    expect(screen.getByText('En attente d’approbation')).toBeOnTheScreen();
    // AC-9.3: no name, no data.
    expect(screen.getByText('Tu ne fais plus partie de ce cercle.')).toBeOnTheScreen();
  });

  it('AC-9.3 hides a neutral card with « Masquer »', async () => {
    mockCircles.mine.mockResolvedValue(myCircles);
    mockCircles.dismissCard.mockResolvedValue(undefined);
    await open('/community');
    await fireEvent.press(await screen.findByTestId('hide-card'));
    await waitFor(() => expect(mockCircles.dismissCard).toHaveBeenCalledWith('item-3'));
  });

  it('AC-9.1 empty, verified: create or enter a code (sky module CTA)', async () => {
    mockCircles.mine.mockResolvedValue(noCircles);
    await open('/community');
    expect(await screen.findByText('Pas encore de cercle')).toBeOnTheScreen();
    expect(screen.getByTestId('create-circle')).toHaveTextContent('Créer un cercle');
    expect(screen.getByTestId('have-code')).toHaveTextContent('J’ai un code');
  });

  it('AC-9.1, AC-1.2 empty, not verified: a code first, then a path to verify (no dead end)', async () => {
    mockCircles.mine.mockResolvedValue(noCircles);
    await open('/community', unverifiedMe);
    expect(await screen.findByTestId('circles-empty-unverified')).toBeOnTheScreen();
    expect(screen.queryByTestId('create-circle')).toBeNull();
    await fireEvent.press(screen.getByTestId('verify-to-create-cta'));
    expect(await screen.findByText('route:verify')).toBeOnTheScreen();
  });

  it('shows the error card with « Réessayer » when the list fails', async () => {
    mockCircles.mine.mockRejectedValue(apiError(500, 'server_error'));
    await open('/community');
    expect(await screen.findByText('Impossible de charger tes cercles')).toBeOnTheScreen();
  });
});

describe('Find a circle (US-17)', () => {
  it('AC-17.8, AC-17.9 searches all of Paris by default and shows public fields only, no count', async () => {
    mockCircles.search.mockResolvedValue({
      circles: [{ ...publicCircle, full: true }],
      pagination: { page: 1, per_page: 20, next_page: 2 },
    });
    await open('/community?tab=find');
    expect(await screen.findByText('Parents CE2 · Jaurès')).toBeOnTheScreen();
    expect(mockCircles.search).toHaveBeenCalledWith(
      { area: [], q: undefined },
      1,
      expect.anything(),
    );
    expect(screen.getByText('Animé par un parent vérifié')).toBeOnTheScreen();
    expect(screen.getByText('Complet')).toBeOnTheScreen();
    expect(screen.queryByText(/résultat/)).toBeNull();
    expect(screen.getByTestId('search-more')).toHaveTextContent('Voir plus');
  });

  it('AC-17.8 empty: create or code, never a dead end', async () => {
    await open('/community?tab=find');
    expect(await screen.findByText('Pas encore de cercle ici')).toBeOnTheScreen();
    expect(screen.getByText('Créer un cercle')).toBeOnTheScreen();
  });

  it('AC-17.9 says when there are too many searches', async () => {
    mockCircles.search.mockRejectedValue(apiError(429, 'rate_limited'));
    await open('/community?tab=find');
    expect(await screen.findByText('Trop de recherches d’un coup')).toBeOnTheScreen();
  });
});

describe('Create and edit (C2)', () => {
  it('AC-1.1, AC-17.1 creates a public circle by default, the private option says it is free (neutral badge)', async () => {
    mockCircles.mine.mockResolvedValue(myCircles);
    mockCircles.create.mockResolvedValue({ circle: adminCircle });
    mockCircles.get.mockResolvedValue({ circle: adminCircle });
    await open('/circles/new');
    expect(await screen.findByTestId('public-safety-note')).toBeOnTheScreen();
    expect(screen.getByText('Gratuit pendant la phase de test')).toBeOnTheScreen();
    expect(screen.getByText('Tu peux créer 3 cercles. Ceci est le 2e.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('circle-name'), 'Parents CE2');
    await fireEvent.press(screen.getByTestId('circle-area'));
    await fireEvent.press(await screen.findByTestId('circle-area-paris-11'));
    await fireEvent.press(screen.getByTestId('circle-submit'));
    await waitFor(() =>
      expect(mockCircles.create).toHaveBeenCalledWith({
        name: 'Parents CE2',
        description: '',
        area: 'paris-11',
        visibility: 'public',
      }),
    );
    expect(await screen.findByText('Cercle créé')).toBeOnTheScreen();
  });

  it('AC-1.3, AC-17.7 shows the server refusals as field messages', () => {
    const t = i18n.t.bind(i18n);
    expect(
      circleServerErrors({ name: ['contains_phone'], description: ['banned_word'] }, t),
    ).toEqual({
      name: 'Retire le numéro de téléphone : on n’affiche pas de coordonnées dans un cercle.',
      description: 'Ce mot n’est pas accepté dans un cercle public. Reformule.',
    });
  });

  it('AC-1.4 says why when 3 circles are already created', async () => {
    mockCircles.mine.mockResolvedValue({
      ...noCircles,
      limits: { ...noCircles.limits, created: 3 },
    });
    await open('/circles/new');
    expect(await screen.findByText('Tu as atteint la limite')).toBeOnTheScreen();
  });

  it('AC-1.2 asks a parent who is not verified to verify first', async () => {
    await open('/circles/new', unverifiedMe);
    expect(await screen.findByText('Vérifie ton identité pour créer un cercle')).toBeOnTheScreen();
  });

  it('AC-17.3 switching a private circle to public asks for confirmation first', async () => {
    mockCircles.get.mockResolvedValue({ circle: { ...adminCircle, visibility: 'private' } });
    mockCircles.update.mockResolvedValue({ circle: adminCircle });
    await open(`/circles/${adminCircle.id}/edit`);
    await fireEvent.press(await screen.findByTestId('type-public-radio'));
    await fireEvent.press(screen.getByTestId('circle-submit'));
    expect(await screen.findByText('Rendre ce cercle public ?')).toBeOnTheScreen();
    expect(mockCircles.update).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('confirm-public'));
    await waitFor(() =>
      expect(mockCircles.update).toHaveBeenCalledWith(
        adminCircle.id,
        expect.objectContaining({ visibility: 'public' }),
      ),
    );
  });

  it('formats the created-circles ordinal', () => {
    expect(ordinal(1, 'fr')).toBe('1er');
    expect(ordinal(2, 'en')).toBe('2nd');
    expect(ordinal(3, 'en')).toBe('3rd');
  });
});

describe('Invite (C3)', () => {
  const invitation = {
    link: 'http://x/join/abc',
    code: 'K7PM-Q2XC',
    enabled: true,
    renewed_at: '2026-10-07T10:00:00Z',
    full: false,
  };

  it('AC-2.1 shows the link and the code, and shares them through the phone', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    mockCircles.invitation.mockResolvedValue({ invitation });
    mockCircles.get.mockResolvedValue({ circle: adminCircle });
    await open(`/circles/${adminCircle.id}/invite`);
    expect(await screen.findByText('K7PM-Q2XC')).toBeOnTheScreen();
    await waitFor(() => expect(mockCircles.get).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('invitation-share'));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('Code : K7PM-Q2XC') });
  });

  it('AC-2.2 renews after a confirmation that states the consequences', async () => {
    mockCircles.invitation.mockResolvedValue({ invitation });
    mockCircles.renewInvitation.mockResolvedValue({
      invitation: { ...invitation, code: 'ZZZZ-2222' },
    });
    await open(`/circles/${adminCircle.id}/invite`);
    await fireEvent.press(await screen.findByTestId('invitation-renew'));
    expect(await screen.findByText('Renouveler le lien et le code ?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-renew'));
    expect(await screen.findByText('ZZZZ-2222')).toBeOnTheScreen();
  });
});

describe('Join (C4)', () => {
  it('AC-3.1, AC-2.3 previews an invitation code with the admin badge, then sends the request', async () => {
    mockCircles.preview.mockResolvedValue({ circle: preview });
    mockCircles.joinByInvitation.mockResolvedValue({ request: { status: 'pending' } });
    await open('/circles/code');
    await fireEvent.changeText(screen.getByTestId('code-input'), 'k7pm q2xc');
    await fireEvent.press(screen.getByTestId('code-continue'));
    expect(await screen.findByText('Voisins de la Roquette')).toBeOnTheScreen();
    expect(mockCircles.preview).toHaveBeenCalledWith({ code: 'K7PMQ2XC' });
    expect(screen.getByText('Claire D.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('join-ask'));
    expect(await screen.findByText('Demande envoyée')).toBeOnTheScreen();
  });

  it('AC-3.2 tells a parent who is not verified they can join without verifying', async () => {
    mockCircles.preview.mockResolvedValue({ circle: preview });
    await open('/join/abcdefghijklmnopqrstuv', unverifiedMe);
    expect(await screen.findByTestId('join-unverified')).toBeOnTheScreen();
  });

  it('AC-3.5 shows one neutral message for an invalid invitation', async () => {
    mockCircles.preview.mockRejectedValue(apiError(410, 'invitation_invalid'));
    await open('/join/abcdefghijklmnopqrstuv');
    expect(
      await screen.findByText(
        'Cette invitation n’est plus valide. Demande à la personne qui t’a invité.',
      ),
    ).toBeOnTheScreen();
  });

  it('AC-3.4 says the 5-circle limit', async () => {
    mockCircles.preview.mockResolvedValue({
      circle: {
        ...preview,
        viewer: { status: 'none', can_request: false, request_blocker: 'member_limit' },
      },
    });
    await open('/join/abcdefghijklmnopqrstuv');
    expect(await screen.findByTestId('join-limit')).toBeOnTheScreen();
    expect(screen.queryByTestId('join-ask')).toBeNull();
  });

  it('AC-3.3 a guest signs up and comes back to the invitation, the request ready but not sent', async () => {
    mockCircles.preview.mockResolvedValue({ circle: { ...preview, admin: null } });
    await renderScreen(ROUTES, { url: '/join/abcdefghijklmnopqrstuv', gate: 'signedOut' });
    await fireEvent.press(await screen.findByTestId('join-sign-up'));
    expect(await screen.findByText('route:sign-up')).toBeOnTheScreen();
    expect(returnHref(consumeReturnTo()!)).toBe('/join/abcdefghijklmnopqrstuv?then=request');
    expect(mockCircles.joinByInvitation).not.toHaveBeenCalled();
  });
});

describe('Circle detail (C5)', () => {
  it('AC-4.1, AC-2.4 shows members with badge and role, and the requests first for admins', async () => {
    mockCircles.get.mockResolvedValue({ circle: adminCircle });
    await open(`/circles/${adminCircle.id}`);
    expect(await screen.findByText('Inès B.')).toBeOnTheScreen();
    const lea = screen.getByTestId('member-m-lea');
    expect(within(lea).getByText('Léa P.')).toBeOnTheScreen();
    expect(within(lea).getByText('Vérifié ✓')).toBeOnTheScreen();
    expect(within(screen.getByTestId('member-m-amir')).getByText('Non vérifié')).toBeOnTheScreen();
    expect(screen.getByText('Claire M. (toi)')).toBeOnTheScreen();
    expect(screen.getByTestId('circle-invite')).toHaveTextContent('Inviter des familles');
  });

  it('AC-2.5 accepts a request', async () => {
    mockCircles.get.mockResolvedValue({ circle: adminCircle });
    mockCircles.accept.mockResolvedValue({ circle: { ...adminCircle, requests: [] } });
    await open(`/circles/${adminCircle.id}`);
    await fireEvent.press(await screen.findByTestId('accept-r-ines'));
    await waitFor(() => expect(mockCircles.accept).toHaveBeenCalledWith(adminCircle.id, 'r-ines'));
    expect(await screen.findByText('Inès B. a rejoint le cercle')).toBeOnTheScreen();
  });

  it('AC-5.2 removes a member after a confirmation that names the consequences', async () => {
    mockCircles.get.mockResolvedValue({ circle: adminCircle });
    mockCircles.removeMember.mockResolvedValue({ circle: adminCircle });
    await open(`/circles/${adminCircle.id}`);
    await fireEvent.press(await screen.findByTestId('member-options-m-lea'));
    await fireEvent.press(await screen.findByTestId('remove-member'));
    expect(await screen.findByText('Retirer Léa P. du cercle ?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-remove'));
    await waitFor(() =>
      expect(mockCircles.removeMember).toHaveBeenCalledWith(adminCircle.id, 'm-lea'),
    );
  });

  it('AC-6.1 offers co-admin only to verified members', async () => {
    mockCircles.get.mockResolvedValue({ circle: adminCircle });
    await open(`/circles/${adminCircle.id}`);
    await fireEvent.press(await screen.findByTestId('member-options-m-amir'));
    expect(await screen.findByText('Pas encore vérifié')).toBeOnTheScreen();
    expect(screen.queryByTestId('make-co-admin')).toBeNull();
  });

  it('AC-6.2 the sole admin is asked to name another admin before leaving', async () => {
    mockCircles.get.mockResolvedValue({ circle: adminCircle });
    await open(`/circles/${adminCircle.id}`);
    await fireEvent.press(await screen.findByTestId('circle-leave'));
    expect(await screen.findByText('Choisis d’abord un nouvel admin')).toBeOnTheScreen();
  });

  it('AC-5.1, AC-16.5 the leave sheet says the joined circle outings are left too', async () => {
    mockCircles.get.mockResolvedValue({ circle: memberCircle });
    mockCircles.leave.mockResolvedValue(undefined);
    await open(`/circles/${memberCircle.id}`);
    await fireEvent.press(await screen.findByTestId('circle-leave'));
    expect(
      await screen.findByText(
        /Tu quitteras aussi la sortie du cercle à laquelle tu es inscrit \(1 à venir\)/,
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('confirm-leave'));
    await waitFor(() => expect(mockCircles.leave).toHaveBeenCalledWith(memberCircle.id));
  });

  it('AC-4.4, AC-16.4 a member who is not verified sees routines hidden and the circle outing', async () => {
    mockCircles.get.mockResolvedValue({ circle: memberCircle });
    await open(`/circles/${memberCircle.id}`, unverifiedMe);
    expect(
      await screen.findByText(
        'Les lieux et horaires des trajets d’enfants sont masqués tant que ton identité n’est pas vérifiée.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Cercle : Parents CE2 · Jaurès')).toBeOnTheScreen();
    expect(screen.getByTestId('circle-suggest')).toHaveTextContent('Proposer une sortie');
  });

  it('AC-6.5 an admin whose verification expired sees the paused rights', async () => {
    mockCircles.get.mockResolvedValue({
      circle: {
        ...adminCircle,
        admin_rights_paused: true,
        requests: [],
        can: { ...adminCircle.can, manage: false, invite: false },
      },
    });
    await open(`/circles/${adminCircle.id}`);
    expect(await screen.findByText('Tes droits d’admin sont en pause')).toBeOnTheScreen();
  });

  it('AC-7.1, AC-7.4 reports the circle', async () => {
    mockCircles.get.mockResolvedValue({ circle: memberCircle });
    mockCircles.report.mockResolvedValue({ report: { id: 'x', created_at: '' } });
    await open(`/circles/${memberCircle.id}`);
    await fireEvent.press(await screen.findByTestId('circle-report'));
    await fireEvent.press(await screen.findByTestId('circle-reason-not_real_group'));
    await fireEvent.press(screen.getByTestId('circle-report-send'));
    await waitFor(() =>
      expect(mockCircles.report).toHaveBeenCalledWith(
        memberCircle.id,
        'not_real_group',
        undefined,
        undefined,
      ),
    );
    expect(await screen.findByText('Merci, on regarde ça')).toBeOnTheScreen();
  });

  it('AC-7.3 a paused circle shows nothing else', async () => {
    mockCircles.get.mockResolvedValue({
      circle: { id: adminCircle.id, audience: 'member', status: 'suspended' },
    });
    await open(`/circles/${adminCircle.id}`);
    expect(await screen.findByText('Ce cercle est en pause.')).toBeOnTheScreen();
  });

  it('AC-4.6, AC-17.3 an unknown or private circle answers « Ce cercle n’est pas disponible »', async () => {
    mockCircles.get.mockRejectedValue(apiError(404, 'not_found'));
    await open(`/circles/${adminCircle.id}`);
    expect(await screen.findByText('Ce cercle n’est pas disponible')).toBeOnTheScreen();
  });
});

describe('Public circle page (C9)', () => {
  it('AC-17.5, AC-17.6 shows only public fields and asks to join', async () => {
    mockCircles.get.mockResolvedValue({ circle: publicCircle });
    mockCircles.askToJoin.mockResolvedValue({ request: { status: 'pending' } });
    await open(`/circles/${publicCircle.id}`);
    expect(await screen.findByText('Animé par un parent vérifié')).toBeOnTheScreen();
    expect(screen.queryByText('Claire M.')).toBeNull();
    await fireEvent.press(screen.getByTestId('public-ask'));
    expect(await screen.findByText('Demande envoyée')).toBeOnTheScreen();
  });

  it('AC-17.13 shows my pending request and lets me cancel it', async () => {
    mockCircles.get.mockResolvedValue({
      circle: {
        ...publicCircle,
        viewer: { status: 'pending', can_request: false, request_blocker: 'pending' },
      },
    });
    mockCircles.cancelRequest.mockResolvedValue(undefined);
    await open(`/circles/${publicCircle.id}`);
    await fireEvent.press(await screen.findByTestId('public-cancel'));
    await waitFor(() => expect(mockCircles.cancelRequest).toHaveBeenCalledWith(publicCircle.id));
  });

  it('AC-17.6, AC-17.10 a guest is asked to sign up and comes back to the page', async () => {
    mockCircles.get.mockResolvedValue({
      circle: {
        ...publicCircle,
        viewer: { status: 'none', can_request: false, request_blocker: 'account_required' },
      },
    });
    await renderScreen(ROUTES, { url: `/circles/${publicCircle.id}`, gate: 'signedOut' });
    await fireEvent.press(await screen.findByTestId('public-sign-up'));
    expect(returnHref(consumeReturnTo()!)).toBe(`/circles/${publicCircle.id}?then=request`);
  });
});

describe('Events link (US-16)', () => {
  it('AC-16.1 offers "Mes cercles" with the circle pre-ticked from the circle, join rule fixed', async () => {
    mockCircles.mine.mockResolvedValue(myCircles);
    await open(`/events/new?circle=${adminCircle.id}`);
    expect(await screen.findByTestId('form-who-sees')).toBeOnTheScreen();
    expect(screen.getByTestId('form-circle-rule')).toHaveTextContent(
      /Tous les membres de ces cercles/,
    );
    expect(screen.queryByTestId('rule-verified')).toBeNull();
  });

  it('AC-16.8 a host without circle sees the invitation to create one', async () => {
    await open('/events/new');
    expect(await screen.findByTestId('form-no-circle')).toBeOnTheScreen();
  });

  it('AC-16.1, AC-16.2 sends the circles with the fixed join rule, and needs one circle', () => {
    const t = i18n.t.bind(i18n);
    const values = {
      ...emptyForm('fr'),
      visibility: 'circles' as const,
      circleIds: [],
      joinRule: 'verified_only' as const,
    };
    expect(validateForm(values, t).circles).toBe('Choisis au moins un cercle.');
    const params = toParams({ ...values, circleIds: ['c1'] }, { includeRule: true });
    expect(params).toMatchObject({
      visibility: 'circles',
      circle_ids: ['c1'],
      join_rule: 'anyone',
    });
  });

  it('AC-16.4 the event card names the circle', () => {
    const t = i18n.t.bind(i18n);
    expect(
      circleBadgeText(
        { ...eventFixture, visibility: 'circles', circles: [{ id: 'c', name: 'Parents CE2' }] },
        t,
      ),
    ).toBe('Cercle : Parents CE2');
    expect(circleBadgeText(eventFixture, t)).toBeNull();
  });
});
