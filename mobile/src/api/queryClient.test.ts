import { ApiError } from './errors';
import { createQueryClient, isAccountGateError } from './queryClient';

describe('query client', () => {
  it('recognises the account gates of contract §1', () => {
    expect(isAccountGateError(new ApiError(403, 'email_not_confirmed', 'x'))).toBe(true);
    expect(isAccountGateError(new ApiError(403, 'closure_pending', 'x'))).toBe(true);
    expect(isAccountGateError(new ApiError(403, 'terms_acceptance_required', 'x'))).toBe(true);
    expect(isAccountGateError(new ApiError(403, 'forbidden', 'x'))).toBe(false);
    expect(isAccountGateError(new Error('x'))).toBe(false);
  });

  it('AC-5.5 a gate code mid-session refreshes the account so the gate can react', async () => {
    const client = createQueryClient();
    client.setQueryData(['me'], { id: '1' });
    const invalidate = jest.spyOn(client, 'invalidateQueries');

    await client
      .fetchQuery({
        queryKey: ['users', '2'],
        queryFn: () => Promise.reject(new ApiError(403, 'terms_acceptance_required', 'x')),
        retry: false,
      })
      .catch(() => undefined);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me'] });
    client.clear(); // no garbage-collection timer left behind
  });
});
