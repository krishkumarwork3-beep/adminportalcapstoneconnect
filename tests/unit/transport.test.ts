// W5 (A4): a production build of the portal refuses a plain-http API off this machine.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "../..");

function check(mode: string, url: string) {
  const script = `const { checkTransport } = await import('./vite.config.ts'); checkTransport(${JSON.stringify(mode)}, ${JSON.stringify(url)});`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, encoding: "utf8" });
}

test("production refuses http:// off this machine; https and local http pass", () => {
  const bad = check("production", "http://api.example.com/api");
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /must use https:\/\//);
  assert.equal(check("production", "https://api.example.com/api").status, 0);
  assert.equal(check("production", "http://localhost:8000/api").status, 0);
  assert.equal(check("development", "http://api.example.com/api").status, 0);
});

test("production fails closed without VITE_API_BASE_URL (no localhost fallback)", () => {
  const none = check("production", "");
  assert.notEqual(none.status, 0);
  assert.match(none.stderr, /VITE_API_BASE_URL is required/);
  assert.equal(check("development", "").status, 0);
});
