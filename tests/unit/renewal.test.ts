// Renewal: 401 -> one shared refresh -> retry once. Only an expired session (401 from /refresh)
// signs out; 429, 5xx and network failures keep the session (rewritten: the old test asserted that
// a network failure signed the user out).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { classifyRefresh, createRenewal, sendWithRenewal, type RefreshResult } from "../../src/lib/renewal.ts";

const answer = (status: number, headers: Record<string, string> = {}) => new Response(status === 204 ? null : "{}", { status, headers });
const never = () => assert.fail("not signed out");

test("ten requests failing together cause one refresh, and each is retried once", async () => {
  let refreshes = 0;
  const renew = createRenewal(async (): Promise<RefreshResult> => {
    refreshes += 1;
    await new Promise((r) => setTimeout(r, 10));
    return { state: "ok" };
  }, never);
  let calls = 0;
  const send = () => Promise.resolve(answer(++calls <= 10 ? 401 : 200));
  const results = await Promise.all(Array.from({ length: 10 }, () => sendWithRenewal(send, renew)));
  assert.equal(refreshes, 1);
  assert.deepEqual(results.map((r) => r.status), Array(10).fill(200));
  assert.equal(calls, 20);
});

test("an expired session (401 from /refresh) signs out once and the request is not retried", async () => {
  let signedOut = 0;
  const renew = createRenewal(() => classifyRefresh(async () => answer(401)), () => (signedOut += 1));
  let calls = 0;
  const r = await sendWithRenewal(() => Promise.resolve(answer((calls += 1, 401))), renew);
  assert.equal(r.status, 401);
  assert.equal(calls, 1);
  assert.equal(signedOut, 1);
});

for (const [name, fail] of [
  ["429 Too Many Requests", () => Promise.resolve(answer(429, { "Retry-After": "30" }))],
  ["503 Service Unavailable", () => Promise.resolve(answer(503))],
  ["500 Internal Server Error", () => Promise.resolve(answer(500))],
  ["a network failure", () => Promise.reject(new Error("offline"))],
] as const) {
  test(`${name} while refreshing keeps the session and returns the original error`, async () => {
    const renew = createRenewal(() => classifyRefresh(fail as () => Promise<Response>), never);
    const r = await sendWithRenewal(() => Promise.resolve(answer(401)), renew);
    assert.equal(r.status, 401);
  });
}

test("after an unavailable refresh it backs off (Retry-After) instead of hammering /refresh", async () => {
  let clock = 1_000_000;
  let refreshes = 0;
  const renew = createRenewal(async (): Promise<RefreshResult> => {
    refreshes += 1;
    return refreshes === 1 ? { state: "unavailable", retryAfter: 30 } : { state: "ok" };
  }, never, () => clock);
  assert.equal(await renew(), false);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await renew(), false); // within 30 s: no request
  assert.equal(refreshes, 1);
  clock += 31_000;
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await renew(), true);
  assert.equal(refreshes, 2);
});

test("classifyRefresh reads 2xx, 401, 429 + Retry-After", async () => {
  assert.deepEqual(await classifyRefresh(async () => answer(204)), { state: "ok" });
  assert.deepEqual(await classifyRefresh(async () => answer(401)), { state: "expired" });
  assert.deepEqual(await classifyRefresh(async () => answer(429, { "Retry-After": "12" })), { state: "unavailable", retryAfter: 12 });
});

test("sign-in endpoints are not retried (their 401 is the answer)", async () => {
  const renew = createRenewal(async () => assert.fail("no refresh"), () => {});
  const r = await sendWithRenewal(() => Promise.resolve(answer(401)), renew, true);
  assert.equal(r.status, 401);
});

test("tokens never touch web storage: no localStorage/sessionStorage use near auth code", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  for (const file of ["src/lib/api.ts", "src/lib/auth.tsx"]) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(text, /(local|session)Storage\.setItem\([^)]*(token|refresh|session)/i, file);
  }
});
