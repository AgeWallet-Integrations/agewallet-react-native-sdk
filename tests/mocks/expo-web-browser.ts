/**
 * Stand-in for expo-web-browser: openBrowserAsync records each call in browserCalls.
 */
export const browserCalls: Array<{ url: string; options?: Record<string, unknown> }> = [];

export async function openBrowserAsync(url: string, options?: Record<string, unknown>) {
  browserCalls.push({ url, options });
  return { type: 'opened' };
}

export function resetWebBrowser(): void {
  browserCalls.length = 0;
}
