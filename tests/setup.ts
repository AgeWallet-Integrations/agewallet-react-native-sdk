/**
 * Runs around every test: resets the native stand-ins in tests/mocks/, silences the SDK's console output, and
 * replaces fetch with a guard that fails the test if it sent a request without installing a stub (fakeServer()).
 */
import { resetCrypto } from './mocks/expo-crypto';
import { expoLinkingNative } from './mocks/expo-modules-core';
import { resetWebBrowser } from './mocks/expo-web-browser';
import { resetReactNative } from './mocks/react-native';
import { keychain } from './mocks/react-native-keychain';

let unstubbedRequests: string[] = [];

beforeEach(() => {
  resetCrypto();
  expoLinkingNative.reset();
  resetWebBrowser();
  resetReactNative();
  keychain.reset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  unstubbedRequests = [];
  global.fetch = (async (input: unknown) => {
    unstubbedRequests.push(String(input));
    throw new Error('unexpected fetch');
  }) as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  expect(unstubbedRequests).toEqual([]);
});
