/**
 * Links built from data (a profile, a message, an announcement, GitHub) go through these before
 * they reach an href, so a stored "javascript:alert(1)" or a look-alike redirect is never
 * clickable. Kept free of imports so the unit tests (node --test) load it as is.
 */

const SITE = "https://same-site.invalid";

/** Whitespace, control characters or a backslash: browsers drop or reinterpret these
 * ("/\t/evil.example" and "/\\evil.example" both become "//evil.example"), so they are refused. */
function hasTrickCharacters(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f || ch === "\\" || (code >= 0x80 && code <= 0x9f) || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

/**
 * A path on this site ("/groups/grp_1?x=1#y"), or null: never another site ("//evil.example",
 * "/\\evil.example", "/%09/evil.example" is a path and stays one), never a scheme ("javascript:").
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || hasTrickCharacters(next)) return null;
  try {
    const url = new URL(next, SITE);
    return url.origin === SITE ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

/**
 * An href that is safe to render: a path on this site, an http(s) link to a named host without a
 * user name or password in it ("https://github.com@evil.example"), or (demo mode only) a blob:
 * this page made itself. Anything else gives undefined, which renders no link.
 */
export function safeHref(value: unknown, origin?: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v || hasTrickCharacters(v)) return undefined;
  if (v.startsWith("/")) return safeNextPath(v) ?? undefined;
  if (origin && v.startsWith(`blob:${origin}/`)) return v;
  try {
    // "https:evil.example" parses too; only the written-out form "https://host" is a link.
    if (!/^https?:\/\//i.test(v)) return undefined;
    const url = new URL(v);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** True when the link leaves this site (opens in a new tab with rel="noopener noreferrer"). */
export function isExternal(href: string | undefined): boolean {
  return !!href && /^https?:/i.test(href);
}
