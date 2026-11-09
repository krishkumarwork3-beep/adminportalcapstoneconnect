// W3: 401 -> one shared refresh -> retry once; a failed refresh signs the page out once.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createRenewal, sendWithRenewal } from "../../src/lib/renewal.ts";

const answer = (status: number) => new Response(status === 204 ? null : "{}", { status });

test("ten requests failing together cause one refresh, and each is retried once", async () => {
  let refreshes = 0;
  const renew = createRenewal(async () => {
    refreshes += 1;
    await new Promise((r) => setTimeout(r, 10));
    return true;
  }, () => assert.fail("not signed out"));
  let calls = 0;
  const send = () => Promise.resolve(answer(++calls <= 10 ? 401 : 200));
  const results = await Promise.all(Array.from({ length: 10 }, () => sendWithRenewal(send, renew)));
  assert.equal(refreshes, 1);
  assert.deepEqual(results.map((r) => r.status), Array(10).fill(200));
  assert.equal(calls, 20);
});

test("a failed refresh signs out once and the request is not retried again", async () => {
  let signedOut = 0;
  const renew = createRenewal(async () => false, () => (signedOut += 1));
  let calls = 0;
  const r = await sendWithRenewal(() => Promise.resolve(answer((calls += 1, 401))), renew);
  assert.equal(r.status, 401);
  assert.equal(calls, 1);
  assert.equal(signedOut, 1);
});

test("a network failure while refreshing counts as signed out, not a crash", async () => {
  let signedOut = 0;
  const renew = createRenewal(() => Promise.reject(new Error("offline")), () => (signedOut += 1));
  assert.equal(await renew(), false);
  assert.equal(signedOut, 1);
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
