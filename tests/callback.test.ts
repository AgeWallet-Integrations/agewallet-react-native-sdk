// AgeWalletCore.handleCallback(): the callback checks, the token exchange, userinfo, the saved verification and expiry.
import { FakeBrowser, REDIRECT_URI, fakeServer, json, makeCore, startFlow, storedJson } from './helpers';
import { keychain } from './mocks/react-native-keychain';

async function started() {
  const browser = new FakeBrowser();
  const core = makeCore({}, browser);
  const state = (await startFlow(core, browser)).searchParams.get('state')!;
  return { core, state, callback: `${REDIRECT_URI}?code=c1&state=${encodeURIComponent(state)}` };
}

// These install no fake server, so tests/setup.ts fails them if they send any request.
describe('rejected before any request', () => {
  test('a denied request returns denied and clears the saved state', async () => {
    const { core } = await started();
    const result = await core.handleCallback(`${REDIRECT_URI}?error=access_denied&error_description=The%20user%20denied%20the%20request`);
    expect(result).toBe('denied');
    expect(storedJson('io.agewallet.sdk.oidc')).toBeNull();
  });

  test('any other error returns failed and clears the saved state', async () => {
    const { core } = await started();
    expect(await core.handleCallback(`${REDIRECT_URI}?error=server_error&error_description=Oops`)).toBe('failed');
    expect(storedJson('io.agewallet.sdk.oidc')).toBeNull();
  });

  test('a missing code or state returns failed', async () => {
    const { core, state } = await started();
    expect(await core.handleCallback(`${REDIRECT_URI}?state=${encodeURIComponent(state)}`)).toBe('failed');
    expect(await core.handleCallback(`${REDIRECT_URI}?code=c1`)).toBe('failed');
  });

  test('a state that does not match returns failed and clears the saved state', async () => {
    const { core } = await started();
    expect(await core.handleCallback(`${REDIRECT_URI}?code=c1&state=rn:other`)).toBe('failed');
    expect(storedJson('io.agewallet.sdk.oidc')).toBeNull();
  });

  test('no saved state returns failed', async () => {
    expect(await makeCore().handleCallback(`${REDIRECT_URI}?code=c1&state=rn:abc`)).toBe('failed');
  });
});

describe('a valid callback', () => {
  test('exchanges the code with the saved verifier, calls userinfo and saves the verification', async () => {
    const { core, callback } = await started();
    const verifier = storedJson('io.agewallet.sdk.oidc').verifier;
    const server = fakeServer();
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);

    expect(await core.handleCallback(callback)).toBe('success');

    expect(server.requests.map((r) => `${r.init.method ?? 'GET'} ${r.url}`)).toEqual([
      'POST https://app.agewallet.io/user/token',
      'GET https://app.agewallet.io/user/userinfo',
    ]);
    const token = server.requests[0];
    expect((token.init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(new URLSearchParams(String(token.init.body)).entries())).toEqual({
      grant_type: 'authorization_code',
      client_id: 'cid',
      redirect_uri: REDIRECT_URI,
      code: 'c1',
      code_verifier: verifier,
    });
    expect((server.requests[1].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');

    expect(storedJson('io.agewallet.sdk.verification')).toEqual({ accessToken: 'tok', expiresAt: 1_800_000_000_000 + 3600 * 1000, isVerified: true, metadata: 'm1' });
    expect(storedJson('io.agewallet.sdk.oidc')).toBeNull();
    expect(await core.isVerified()).toBe(true);
    expect(await core.getMetadata()).toBe('m1');
  });

  test('stays verified until expires_in has passed, then the record is deleted', async () => {
    const { core, callback } = await started();
    fakeServer({ token: () => json({ access_token: 'tok', token_type: 'Bearer', expires_in: 60, scope: 'openid age' }) });
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);

    await core.handleCallback(callback);

    now.mockReturnValue(1_800_000_000_000 + 59_999);
    expect(await core.isVerified()).toBe(true);
    now.mockReturnValue(1_800_000_000_000 + 60_000);
    expect(await core.isVerified()).toBe(false);
    expect(keychain.items.has('io.agewallet.sdk.verification')).toBe(false);
  });

  test('with no metadata in userinfo saves none', async () => {
    const { core, callback } = await started();
    fakeServer({ userinfo: () => json({ sub: 'u1', age_verified: true }) });

    await core.handleCallback(callback);

    expect(storedJson('io.agewallet.sdk.verification')).not.toHaveProperty('metadata');
    expect(await core.getMetadata()).toBeNull();
  });

  test('uses custom token and userinfo endpoints', async () => {
    const browser = new FakeBrowser();
    const core = makeCore({ endpoints: { token: 'https://aw.test/x/token', userinfo: 'https://aw.test/x/userinfo' } }, browser);
    const state = (await startFlow(core, browser)).searchParams.get('state')!;
    const server = fakeServer();

    await core.handleCallback(`${REDIRECT_URI}?code=c1&state=${encodeURIComponent(state)}`);

    expect(server.requests.map((r) => r.url)).toEqual(['https://aw.test/x/token', 'https://aw.test/x/userinfo']);
  });

  test('cannot be used twice', async () => {
    const { core, callback } = await started();
    const server = fakeServer();

    expect(await core.handleCallback(callback)).toBe('success');
    expect(await core.handleCallback(callback)).toBe('failed');
    expect(server.requests).toHaveLength(2);
  });

  test('clearVerification removes the saved verification', async () => {
    const { core, callback } = await started();
    fakeServer();
    await core.handleCallback(callback);

    await core.clearVerification();

    expect(await core.isVerified()).toBe(false);
    expect(keychain.items.has('io.agewallet.sdk.verification')).toBe(false);
  });
});

describe('fails and saves nothing', () => {
  async function expectFailure(replies: Parameters<typeof fakeServer>[0], requests: number) {
    const { core, callback } = await started();
    const server = fakeServer(replies);

    expect(await core.handleCallback(callback)).toBe('failed');
    expect(server.requests).toHaveLength(requests);
    expect(await core.isVerified()).toBe(false);
    expect(storedJson('io.agewallet.sdk.verification')).toBeNull();
    expect(storedJson('io.agewallet.sdk.oidc')).toBeNull();
  }

  test('when the token request is refused', async () => {
    await expectFailure({ token: () => json({ error: 'invalid_grant' }, 400) }, 1);
  });

  test('when the token reply is not JSON', async () => {
    await expectFailure({ token: () => new Response('<html>error</html>', { status: 200 }) }, 1);
  });

  test('when userinfo is refused', async () => {
    await expectFailure({ userinfo: () => json({ error: 'invalid_token' }, 401) }, 2);
  });

  test('when age_verified is false', async () => {
    await expectFailure({ userinfo: () => json({ sub: 'u1', age_verified: false }) }, 2);
  });

  test('when age_verified is missing', async () => {
    await expectFailure({ userinfo: () => json({ sub: 'u1' }) }, 2);
  });
});
