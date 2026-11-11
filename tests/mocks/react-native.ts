/**
 * Stand-in for the parts of react-native the SDK uses: Platform.OS (set per test), NativeModules (where a test puts
 * the demo app's AgeWalletCallback module) and Linking.openURL (recorded in openedUrls).
 */
export const Platform: { OS: string } = { OS: 'ios' };

export const NativeModules: Record<string, any> = {};

export const openedUrls: string[] = [];

export const Linking = {
  async openURL(url: string): Promise<boolean> {
    openedUrls.push(url);
    return true;
  },
};

export function resetReactNative(): void {
  Platform.OS = 'ios';
  for (const key of Object.keys(NativeModules)) delete NativeModules[key];
  openedUrls.length = 0;
}
