// QA (mobile-account): the data download never puts the token in the URL.
import { accountApi } from '../../api/account';
import { createApiClient } from '../../api/client';
import { jsonResponse, memoryTokenStore } from '../../test/fakes';

describe('QA My account', () => {
  it('AC-12.2 sends the token only in the Authorization header of the download', async () => {
    const fetchImpl = jest.fn().mockImplementation(async () => jsonResponse(200, { account: {} }));
    const client = createApiClient({
      baseUrl: 'http://api.test',
      tokenStore: memoryTokenStore('secret-jwt'),
      getLocale: () => 'fr',
      fetchImpl,
    });
    await accountApi(client).downloadDataExport();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/data_export/download');
    expect(String(url)).not.toContain('secret-jwt');
    expect(init.headers.Authorization).toBe('Bearer secret-jwt');
  });
});
