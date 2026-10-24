/** Keep loopback visits on the configured OAuth origin without redirecting remote hosts. */
export function canonicalAuthPageURL(input, configuredOrigin) {
  if (!configuredOrigin) return null;
  try {
    const current = new URL(input), canonical = new URL(configuredOrigin);
    const loopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
    if (current.origin === canonical.origin || !loopback(current.hostname) || !loopback(canonical.hostname) || current.protocol !== 'http:' || canonical.protocol !== 'http:' || current.port !== canonical.port) return null;
    return new URL(current.pathname + current.search + current.hash, canonical.origin).href;
  } catch { return null; }
}
