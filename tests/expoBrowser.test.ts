// ExpoBrowser (src/expo/ExpoBrowser.ts): iOS opens Safari; Android opens the browser and polls the demo app's
// AgeWalletCallback native module every 500 ms for up to 5 minutes.
import { ExpoBrowser } from '../src/expo/ExpoBrowser';
import { browserCalls } from './mocks/expo-web-browser';
import { NativeModules, Platform, openedUrls } from './mocks/react-native';
import { REDIRECT_URI } from './helpers';

const AUTH_URL = 'https://app.agewallet.io/user/authorize?client_id=cid';

/** Tracks whether a promise has settled, and with what. */
function track<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: T } = { settled: false };
  promise.then((value) => Object.assign(state, { settled: true, value }));
  return state;
}

describe('ExpoBrowser', () => {
  test('openUrl opens the in-app browser', async () => {
    await new ExpoBrowser().openUrl('https://example.com/');
    expect(browserCalls.map((c) => c.url)).toEqual(['https://example.com/']);
  });

  test('on iOS opens the URL in Safari and returns null', async () => {
    Platform.OS = 'ios';

    expect(await new ExpoBrowser().openAuthSession(AUTH_URL, REDIRECT_URI)).toBeNull();
    expect(openedUrls).toEqual([AUTH_URL]);
    expect(browserCalls).toEqual([]);
  });

  describe('on Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      // Leaves the queues that Response.json() and promises use running
      jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate', 'clearImmediate'] });
    });

    test('opens the browser and returns the first callback URL that starts with the redirect URI', async () => {
      const replies = [null, 'https://other.example/callback?code=x', `${REDIRECT_URI}?code=c1&state=rn:s`];
      NativeModules.AgeWalletCallback = { getAndClear: async () => replies.shift() ?? null };

      const result = track(new ExpoBrowser().openAuthSession(AUTH_URL, REDIRECT_URI));
      expect(browserCalls).toEqual([{ url: AUTH_URL, options: { showInRecents: true } }]);

      await jest.advanceTimersByTimeAsync(1000);
      expect(result.settled).toBe(false);
      await jest.advanceTimersByTimeAsync(500);
      expect(result).toEqual({ settled: true, value: `${REDIRECT_URI}?code=c1&state=rn:s` });
    });

    test('returns null when the native module fails', async () => {
      NativeModules.AgeWalletCallback = { getAndClear: async () => { throw new Error('boom'); } };

      const result = track(new ExpoBrowser().openAuthSession(AUTH_URL, REDIRECT_URI));
      await jest.advanceTimersByTimeAsync(500);

      expect(result).toEqual({ settled: true, value: null });
    });

    test('returns null when the app has no AgeWalletCallback module', async () => {
      const result = track(new ExpoBrowser().openAuthSession(AUTH_URL, REDIRECT_URI));
      await jest.advanceTimersByTimeAsync(500);

      expect(result).toEqual({ settled: true, value: null });
    });

    test('gives up with null after 5 minutes', async () => {
      let polls = 0;
      NativeModules.AgeWalletCallback = { getAndClear: async () => { polls++; return null; } };

      const result = track(new ExpoBrowser().openAuthSession(AUTH_URL, REDIRECT_URI));
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000 - 500);
      expect(result.settled).toBe(false);
      await jest.advanceTimersByTimeAsync(500);

      expect(result).toEqual({ settled: true, value: null });
      expect(polls).toBe(600);
    });
  });
});
