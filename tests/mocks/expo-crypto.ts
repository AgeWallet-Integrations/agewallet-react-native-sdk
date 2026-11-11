/**
 * Stand-in for expo-crypto: getRandomBytes and digestStringAsync on Node's crypto.
 * queueRandomBytes() makes the next getRandomBytes() call return fixed bytes.
 */
import { createHash, randomBytes } from 'crypto';

export enum CryptoDigestAlgorithm {
  SHA256 = 'SHA-256',
}

export enum CryptoEncoding {
  HEX = 'hex',
  BASE64 = 'base64',
}

const queued: Uint8Array[] = [];

export function queueRandomBytes(bytes: number[]): void {
  queued.push(Uint8Array.from(bytes));
}

export function resetCrypto(): void {
  queued.length = 0;
}

export function getRandomBytes(byteCount: number): Uint8Array {
  return queued.shift() ?? new Uint8Array(randomBytes(byteCount));
}

export async function digestStringAsync(
  algorithm: CryptoDigestAlgorithm,
  data: string,
  options: { encoding?: CryptoEncoding } = {}
): Promise<string> {
  if (algorithm !== CryptoDigestAlgorithm.SHA256) {
    throw new Error(`expo-crypto stand-in: ${algorithm} not supported`);
  }
  return createHash('sha256').update(data, 'utf8').digest(options.encoding === CryptoEncoding.BASE64 ? 'base64' : 'hex');
}
