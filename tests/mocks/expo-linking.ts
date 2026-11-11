/**
 * Stand-in for expo-linking's parse(): scheme, hostname, path and decoded queryParams from the WHATWG URL parser,
 * the shape expo-linking returns.
 */
export function parse(url: string) {
  const parsed = new URL(url);
  return {
    scheme: parsed.protocol.replace(/:$/, ''),
    hostname: parsed.hostname,
    path: parsed.pathname.replace(/^\//, ''),
    queryParams: Object.fromEntries(parsed.searchParams.entries()),
  };
}
