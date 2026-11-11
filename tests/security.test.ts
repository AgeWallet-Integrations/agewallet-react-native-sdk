// PKCE verifier and challenge, state and nonce (src/core/Security.ts).
import { Security } from '../src/core/Security';
import { queueRandomBytes } from './mocks/expo-crypto';

// RFC 7636 Appendix B: the 32 octets, the code_verifier they encode to, and its S256 code_challenge
const RFC_OCTETS = [116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121];
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('Security', () => {
  test('encodes the RFC 7636 example octets to its verifier and challenge', async () => {
    const security = new Security();
    queueRandomBytes(RFC_OCTETS);

    const verifier = security.generatePkceVerifier();

    expect(verifier).toBe(RFC_VERIFIER);
    expect(await security.generatePkceChallenge(verifier)).toBe(RFC_CHALLENGE);
  });

  test('a verifier is 86 Base64-URL characters from 64 random bytes, with no padding', () => {
    expect(new Security().generatePkceVerifier()).toMatch(/^[A-Za-z0-9_-]{86}$/);
  });

  test('a challenge is 43 Base64-URL characters', async () => {
    const security = new Security();
    expect(await security.generatePkceChallenge(security.generatePkceVerifier())).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test('verifiers differ', () => {
    const security = new Security();
    expect(security.generatePkceVerifier()).not.toBe(security.generatePkceVerifier());
  });

  test('state and nonce are 32 lowercase hex characters and differ each time', () => {
    const security = new Security();
    expect(security.generateState()).toMatch(/^[0-9a-f]{32}$/);
    expect(security.generateNonce()).toMatch(/^[0-9a-f]{32}$/);
    expect(security.generateState()).not.toBe(security.generateState());
    expect(security.generateNonce()).not.toBe(security.generateNonce());
  });
});
