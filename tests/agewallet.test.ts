// The public AgeWallet class (src/expo/index.ts) with the Expo browser and linking, end to end on iOS and Android.
import { AgeWallet } from '../src/expo';
import { expoLinkingNative } from './mocks/expo-modules-core';
import { browserCalls } from './mocks/expo-web-browser';
import { NativeModules, Platform, openedUrls } from './mocks/react-native';
import { REDIRECT_URI, fakeServer } from './helpers';

const callbackFor = (authUrl: string) =>
  `${REDIRECT_URI}?code=c1&state=${encodeURIComponent(new URL(authUrl).searchParams.get('state')!)}`;

describe('AgeWallet', () => {
  test('on iOS: opens Safari, then the app passes the callback in', async () => {
    Platform.OS = 'ios';
    const ageWallet = new AgeWallet({ clientId: 'cid', redirectUri: REDIRECT_URI, metadata: 'tenant-1' });

    expect(await ageWallet.startVerification()).toBeNull();
    expect(new URL(openedUrls[0]).searchParams.get('metadata')).toBe('tenant-1');

    fakeServer();
    expect(await ageWallet.handleCallback(callbackFor(openedUrls[0]))).toBe('success');
    expect(await ageWallet.isVerified()).toBe(true);
    expect(await ageWallet.getMetadata()).toBe('m1');

    await ageWallet.clearVerification();
    expect(await ageWallet.isVerified()).toBe(false);
  });

  test('on Android: picks up the callback from the AgeWalletCallback module', async () => {
    Platform.OS = 'android';
    // Leaves the queues that Response.json() and promises use running
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate', 'clearImmediate'] });
    NativeModules.AgeWalletCallback = { getAndClear: async () => (browserCalls[0] ? callbackFor(browserCalls[0].url) : null) };
    const ageWallet = new AgeWallet({ clientId: 'cid', redirectUri: REDIRECT_URI });
    fakeServer();

    const result = ageWallet.startVerification({ metadata: 'order:42' });
    await jest.advanceTimersByTimeAsync(500);

    expect(await result).toBe('success');
    expect(new URL(browserCalls[0].url).searchParams.get('metadata')).toBe('order:42');
    expect(await ageWallet.isVerified()).toBe(true);
  });

  test('setMetadata, getInitialUrl and addUrlListener pass through', async () => {
    Platform.OS = 'ios';
    const ageWallet = new AgeWallet({ clientId: 'cid', redirectUri: REDIRECT_URI });

    ageWallet.setMetadata('tenant-2');
    await ageWallet.startVerification();
    expect(new URL(openedUrls[0]).searchParams.get('metadata')).toBe('tenant-2');

    expoLinkingNative.initialUrl = `${REDIRECT_URI}?code=c1`;
    expect(await ageWallet.getInitialUrl()).toBe(`${REDIRECT_URI}?code=c1`);

    const received: string[] = [];
    const cleanup = ageWallet.addUrlListener((url) => received.push(url));
    expoLinkingNative.listeners[0].listener({ url: 'https://shop.example/x' });
    cleanup();
    expect(received).toEqual(['https://shop.example/x']);
    expect(expoLinkingNative.listeners).toEqual([]);
  });
});
