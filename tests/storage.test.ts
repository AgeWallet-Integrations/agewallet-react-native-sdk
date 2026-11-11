// Storage (src/core/Storage.ts) over the keychain stand-in.
import { Storage } from '../src/core/Storage';
import { keychain } from './mocks/react-native-keychain';

const inAnHour = () => Date.now() + 3600 * 1000;

describe('Storage', () => {
  test('saves a verification under the io.agewallet.sdk.verification service and reads it back', async () => {
    const storage = new Storage();
    const verification = { accessToken: 'tok', expiresAt: inAnHour(), isVerified: true, metadata: 'm1' };

    await storage.setVerification(verification);

    expect(keychain.items.get('io.agewallet.sdk.verification')?.username).toBe('agewallet_verification');
    expect(await storage.getVerification()).toEqual(verification);
  });

  test('saves OIDC state under the io.agewallet.sdk.oidc service, apart from the verification', async () => {
    const storage = new Storage();
    await storage.setVerification({ accessToken: 'tok', expiresAt: inAnHour(), isVerified: true });
    await storage.setOidcState({ state: 's', verifier: 'v', nonce: 'n' });

    expect(keychain.items.get('io.agewallet.sdk.oidc')?.username).toBe('agewallet_oidc_state');
    expect(await storage.getOidcState()).toEqual({ state: 's', verifier: 'v', nonce: 'n' });

    await storage.clearOidcState();
    expect(await storage.getOidcState()).toBeNull();
    expect(await storage.getVerification()).not.toBeNull();
  });

  test('an expired verification reads as none and is deleted', async () => {
    const storage = new Storage();
    await storage.setVerification({ accessToken: 'tok', expiresAt: Date.now() - 1000, isVerified: true });

    expect(await storage.getVerification()).toBeNull();
    expect(keychain.items.has('io.agewallet.sdk.verification')).toBe(false);
  });

  test('corrupt JSON reads as none', async () => {
    keychain.items.set('io.agewallet.sdk.verification', { username: 'agewallet_verification', password: '{not json' });
    keychain.items.set('io.agewallet.sdk.oidc', { username: 'agewallet_oidc_state', password: '{not json' });

    expect(await new Storage().getVerification()).toBeNull();
    expect(await new Storage().getOidcState()).toBeNull();
  });

  test('a failing keychain reads as none, and clearing does not throw', async () => {
    keychain.failing = true;
    const storage = new Storage();

    expect(await storage.getVerification()).toBeNull();
    expect(await storage.getOidcState()).toBeNull();
    await expect(storage.clearVerification()).resolves.toBeUndefined();
    await expect(storage.clearOidcState()).resolves.toBeUndefined();
  });
});
