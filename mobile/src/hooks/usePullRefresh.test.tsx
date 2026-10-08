import { act, renderHook, waitFor } from '@testing-library/react-native';

import { colorValue } from '../theme/colors';
import { usePullRefresh } from './usePullRefresh';

describe('usePullRefresh', () => {
  it('spins only during a pull, in the module colour', async () => {
    let resolve: () => void = () => {};
    const refresh = jest.fn(() => new Promise<void>((r) => (resolve = r)));
    const { result } = await renderHook(() => usePullRefresh(refresh, 'circles'));
    expect(result.current.refreshing).toBe(false);
    expect(result.current.tintColor).toBe(colorValue('sky-dark'));
    await act(async () => result.current.onRefresh());
    expect(result.current.refreshing).toBe(true);
    await act(async () => resolve());
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it('stops spinning when the refresh fails', async () => {
    const { result } = await renderHook(() =>
      usePullRefresh(() => Promise.reject(new Error('offline')), 'events'),
    );
    expect(result.current.colors).toEqual([colorValue('green-dark')]);
    await act(async () => result.current.onRefresh());
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });
});
