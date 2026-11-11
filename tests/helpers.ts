/**
 * Shared test fakes: an IBrowser and ILinking for AgeWalletCore, and fakeServer(), which replaces fetch with a fake
 * AgeWallet server for one test.
 */
import { AgeWalletCore } from '../src/core/AgeWalletCore';
import { AgeWalletConfig } from '../src/core/types';
import { IBrowser } from '../src/interfaces/IBrowser';
import { ILinking } from '../src/interfaces/ILinking';
import { keychain } from './mocks/react-native-keychain';

export const REDIRECT_URI = 'https://shop.example/callback';

/** Records the URLs it is asked to open; openAuthSession returns reply(url), null by default. */
export class FakeBrowser implements IBrowser {
  opened: string[] = [];
  constructor(private reply: (url: string) => string | null = () => null) {}
  async openUrl(url: string): Promise<void> {
    this.opened.push(url);
  }
  async openAuthSession(url: string): Promise<string | null> {
    this.opened.push(url);
    return this.reply(url);
  }
}

/** ILinking whose parseUrl reads the query with the WHATWG URL parser. */
export const fakeLinking: ILinking = {
  parseUrl(url: string) {
    const query = new URL(url).searchParams;
    return {
      code: query.get('code') ?? undefined,
      state: query.get('state') ?? undefined,
      error: query.get('error') ?? undefined,
      error_description: query.get('error_description') ?? undefined,
    };
  },
  getInitialUrl: async () => null,
  addListener: () => () => undefined,
};

/** An AgeWalletCore with client ID "cid", REDIRECT_URI and the given browser. */
export function makeCore(config: Partial<AgeWalletConfig> = {}, browser: IBrowser = new FakeBrowser()): AgeWalletCore {
  return new AgeWalletCore({ clientId: 'cid', redirectUri: REDIRECT_URI, ...config }, browser, fakeLinking);
}

/** Starts a flow on [core] with a browser that returns nothing, and returns the authorize URL it opened. */
export async function startFlow(core: AgeWalletCore, browser: FakeBrowser): Promise<URL> {
  await core.startVerification();
  return new URL(browser.opened[browser.opened.length - 1]);
}

/** The JSON stored in the keychain stand-in for [service], or null. */
export function storedJson(service: 'io.agewallet.sdk.oidc' | 'io.agewallet.sdk.verification'): any {
  const item = keychain.items.get(service);
  return item ? JSON.parse(item.password) : null;
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Replaces fetch for this test: records every request, answers URLs ending in /token and /userinfo with
 * replies.token() and replies.userinfo() (by default a 1-hour token "tok" and a verified user with metadata "m1"),
 * and anything else with 404.
 */
export function fakeServer(replies: { token?: () => Response; userinfo?: () => Response } = {}) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  global.fetch = (async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith('/token')) return (replies.token ?? (() => json({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600, scope: 'openid age' })))();
    if (url.endsWith('/userinfo')) return (replies.userinfo ?? (() => json({ sub: 'u1', age_verified: true, metadata: 'm1' })))();
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { requests };
}
