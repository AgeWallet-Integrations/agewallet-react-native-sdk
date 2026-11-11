// AgeWalletCore.startVerification(): the authorize URL, the OIDC state it saves, metadata and the config checks.
import { createHash } from 'crypto';
import { AgeWalletCore } from '../src/core/AgeWalletCore';
import { FakeBrowser, REDIRECT_URI, fakeLinking, fakeServer, makeCore, startFlow, storedJson } from './helpers';

const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

describe('authorize URL', () => {
  test('carries the OIDC parameters', async () => {
    const browser = new FakeBrowser();
    const url = await startFlow(makeCore({}, browser), browser);
    const params = Object.fromEntries(url.searchParams.entries());

    expect(url.origin + url.pathname).toBe('https://app.agewallet.io/user/authorize');
    expect(Object.keys(params).sort()).toEqual(['client_id', 'code_challenge', 'code_challenge_method', 'nonce', 'redirect_uri', 'response_type', 'scope', 'state']);
    expect(params.response_type).toBe('code');
    expect(params.client_id).toBe('cid');
    expect(params.redirect_uri).toBe(REDIRECT_URI);
    expect(params.scope).toBe('openid age');
    expect(params.code_challenge_method).toBe('S256');
  });

  test('the saved state, verifier and nonce match the URL', async () => {
    const browser = new FakeBrowser();
    const url = await startFlow(makeCore({}, browser), browser);
    const saved = storedJson('io.agewallet.sdk.oidc');

    expect(url.searchParams.get('state')).toMatch(/^rn:[0-9a-f]{32}$/);
    expect(saved.state).toBe(url.searchParams.get('state'));
    expect(saved.nonce).toBe(url.searchParams.get('nonce'));
    expect(saved.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(url.searchParams.get('code_challenge')).toBe(s256(saved.verifier));
  });

  test('each start has its own state, nonce and challenge', async () => {
    const browser = new FakeBrowser();
    const core = makeCore({}, browser);
    const first = (await startFlow(core, browser)).searchParams;
    const second = (await startFlow(core, browser)).searchParams;

    for (const name of ['state', 'nonce', 'code_challenge']) {
      expect(second.get(name)).not.toBe(first.get(name));
    }
  });

  test('an endpoint override keeps the other defaults', async () => {
    const browser = new FakeBrowser();
    const core = makeCore({ endpoints: { auth: 'https://dev3.agewallet.io/user/authorize' } }, browser);
    const url = await startFlow(core, browser);
    const server = fakeServer();

    await core.handleCallback(`${REDIRECT_URI}?code=c1&state=${encodeURIComponent(url.searchParams.get('state')!)}`);

    expect(url.origin + url.pathname).toBe('https://dev3.agewallet.io/user/authorize');
    expect(server.requests.map((r) => r.url)).toEqual(['https://app.agewallet.io/user/token', 'https://app.agewallet.io/user/userinfo']);
  });

  test('returns null when the browser returns no callback', async () => {
    expect(await makeCore().startVerification()).toBeNull();
  });

  test('handles the callback the browser returns', async () => {
    const browser = new FakeBrowser((url) => `${REDIRECT_URI}?code=c1&state=${encodeURIComponent(new URL(url).searchParams.get('state')!)}`);
    fakeServer();

    expect(await makeCore({}, browser).startVerification()).toBe('success');
  });

  test('an empty client ID or redirect URI is rejected', () => {
    expect(() => new AgeWalletCore({ clientId: '', redirectUri: REDIRECT_URI }, new FakeBrowser(), fakeLinking)).toThrow('Missing clientId');
    expect(() => new AgeWalletCore({ clientId: 'cid', redirectUri: '' }, new FakeBrowser(), fakeLinking)).toThrow('Missing redirectUri');
  });
});

describe('metadata', () => {
  async function sentMetadata(core: AgeWalletCore, browser: FakeBrowser, options?: { metadata?: string }) {
    await core.startVerification(options);
    return new URL(browser.opened[browser.opened.length - 1]).searchParams.get('metadata');
  }

  test('is left out when none is set', async () => {
    const browser = new FakeBrowser();
    expect(await sentMetadata(makeCore({}, browser), browser)).toBeNull();
  });

  test('the config default is sent', async () => {
    const browser = new FakeBrowser();
    expect(await sentMetadata(makeCore({ metadata: 'tenant-1' }, browser), browser)).toBe('tenant-1');
  });

  test('a per-call value wins without changing the default', async () => {
    const browser = new FakeBrowser();
    const core = makeCore({ metadata: 'tenant-1' }, browser);
    expect(await sentMetadata(core, browser, { metadata: 'order:42 & co' })).toBe('order:42 & co');
    expect(await sentMetadata(core, browser)).toBe('tenant-1');
  });

  test('a per-call empty value sends none', async () => {
    const browser = new FakeBrowser();
    expect(await sentMetadata(makeCore({ metadata: 'tenant-1' }, browser), browser, { metadata: '' })).toBeNull();
  });

  test('setMetadata changes the default, and null or undefined clears it', async () => {
    const browser = new FakeBrowser();
    const core = makeCore({ metadata: 'tenant-1' }, browser);
    core.setMetadata('tenant-2');
    expect(await sentMetadata(core, browser)).toBe('tenant-2');
    core.setMetadata(null);
    expect(await sentMetadata(core, browser)).toBeNull();
    core.setMetadata('tenant-3');
    core.setMetadata(undefined);
    expect(await sentMetadata(core, browser)).toBeNull();
  });

  test('the 4096 limit counts UTF-8 bytes', async () => {
    const atLimit = 'é'.repeat(2048); // 2 bytes each in UTF-8
    const overByOneByte = atLimit + 'a';
    const browser = new FakeBrowser();
    const core = makeCore({}, browser);

    expect(await sentMetadata(core, browser, { metadata: atLimit })).toBe(atLimit);
    expect(() => makeCore({ metadata: overByOneByte })).toThrow('4096-byte limit');
    expect(() => core.setMetadata(overByOneByte)).toThrow('4096-byte limit');
    await expect(core.startVerification({ metadata: overByOneByte })).rejects.toThrow('4096-byte limit');
    expect(() => core.setMetadata('a'.repeat(4096))).not.toThrow();
  });
});
