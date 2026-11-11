/**
 * Stand-in for react-native-keychain: generic passwords in a Map keyed by service.
 * keychain.items is the store; keychain.failing makes every call reject, as a broken keychain would.
 */
type Item = { username: string; password: string };

export const keychain = {
  items: new Map<string, Item>(),
  failing: false,
  reset(): void {
    this.items.clear();
    this.failing = false;
  },
};

function check(): void {
  if (keychain.failing) throw new Error('keychain unavailable');
}

export async function setGenericPassword(username: string, password: string, options: { service?: string } = {}) {
  check();
  const service = options.service ?? 'default';
  keychain.items.set(service, { username, password });
  return { service, storage: 'stand-in' };
}

export async function getGenericPassword(options: { service?: string } = {}) {
  check();
  const service = options.service ?? 'default';
  const item = keychain.items.get(service);
  return item ? { ...item, service, storage: 'stand-in' } : false;
}

export async function resetGenericPassword(options: { service?: string } = {}) {
  check();
  return keychain.items.delete(options.service ?? 'default');
}
