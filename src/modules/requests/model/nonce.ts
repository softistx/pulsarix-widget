/**
 * The host page's CSP nonce, for the `<style>` the chat scroll area injects into the shadow
 * root. A host that sets `style-src 'nonce-X'` also gives its own style and script elements
 * that nonce, which stays readable on the `nonce` property; the `NonceProvider` falls back
 * to `<meta property="csp-nonce">` when this finds none.
 */
let cached: string | undefined | null = null;

export function pageNonce(): string | undefined {
  if (cached !== null) return cached;
  const holder = document.querySelector<HTMLElement>(
    "style[nonce], script[nonce]",
  );
  cached = holder?.nonce || undefined;
  return cached;
}
