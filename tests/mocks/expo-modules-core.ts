/**
 * Stand-in for expo-modules-core's requireNativeModule('ExpoLinking'): getLinkingURL() returns
 * expoLinkingNative.initialUrl, addListener() records the listener and returns a subscription whose remove()
 * takes it out again.
 */
type Listener = (event: unknown) => void;

export const expoLinkingNative = {
  initialUrl: null as string | null,
  listeners: [] as Array<{ eventName: string; listener: Listener }>,
  reset(): void {
    this.initialUrl = null;
    this.listeners.length = 0;
  },
};

export function requireNativeModule<T>(name: string): T {
  if (name !== 'ExpoLinking') throw new Error(`expo-modules-core stand-in: no native module ${name}`);
  const native = {
    getLinkingURL: () => expoLinkingNative.initialUrl,
    addListener(eventName: string, listener: Listener) {
      const entry = { eventName, listener };
      expoLinkingNative.listeners.push(entry);
      return {
        remove() {
          const index = expoLinkingNative.listeners.indexOf(entry);
          if (index >= 0) expoLinkingNative.listeners.splice(index, 1);
        },
      };
    },
  };
  return native as unknown as T;
}
