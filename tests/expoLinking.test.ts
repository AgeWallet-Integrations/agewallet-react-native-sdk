// ExpoLinking (src/expo/ExpoLinking.ts): callback parameters from a URL, the launch URL, and the URL listener on
// Expo's native linking module (stand-in in tests/mocks/expo-modules-core.ts).
import { ExpoLinking } from '../src/expo/ExpoLinking';
import { expoLinkingNative } from './mocks/expo-modules-core';

describe('ExpoLinking', () => {
  test('parseUrl reads the code, state and error fields, decoded', () => {
    const linking = new ExpoLinking();

    expect(linking.parseUrl('https://shop.example/callback?code=a%2Bb&state=rn%3Axyz')).toEqual({
      code: 'a+b',
      state: 'rn:xyz',
      error: undefined,
      error_description: undefined,
    });
    expect(linking.parseUrl('agewallet-demo://callback?error=access_denied&error_description=The%20user%20denied%20the%20request')).toEqual({
      code: undefined,
      state: undefined,
      error: 'access_denied',
      error_description: 'The user denied the request',
    });
  });

  test('getInitialUrl returns the launch URL, or null', async () => {
    const linking = new ExpoLinking();
    expect(await linking.getInitialUrl()).toBeNull();

    expoLinkingNative.initialUrl = 'https://shop.example/callback?code=c1';
    expect(await linking.getInitialUrl()).toBe('https://shop.example/callback?code=c1');
  });

  test('addListener passes on string and { url } events, and its cleanup removes it', () => {
    const received: string[] = [];
    const cleanup = new ExpoLinking().addListener((url) => received.push(url));

    expect(expoLinkingNative.listeners.map((l) => l.eventName)).toEqual(['onURLReceived']);
    expoLinkingNative.listeners[0].listener('https://shop.example/a');
    expoLinkingNative.listeners[0].listener({ url: 'https://shop.example/b' });
    expect(received).toEqual(['https://shop.example/a', 'https://shop.example/b']);

    cleanup();
    expect(expoLinkingNative.listeners).toEqual([]);
  });
});
