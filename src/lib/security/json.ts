/**
 * JSON from the network (API answers, live socket events): keys that could reach an object's
 * prototype ("__proto__", "constructor", "prototype") are dropped while parsing, so a hostile or
 * compromised payload can never pollute Object.prototype through a later merge or spread.
 */

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

export function parseJson<T = unknown>(text: string): T {
  return JSON.parse(text, (key, value) => (FORBIDDEN.has(key) ? undefined : value)) as T;
}

/** A key from data that is safe to use as a property name on a plain object. */
export function isSafeKey(key: unknown): key is string {
  return typeof key === "string" && !FORBIDDEN.has(key);
}
