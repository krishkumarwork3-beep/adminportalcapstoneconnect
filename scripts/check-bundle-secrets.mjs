#!/usr/bin/env node
/**
 * Fails if the code shipped to browsers contains anything secret-shaped, or the value of any
 * environment variable that is not meant to be public. Prints names only, never a value.
 *
 *   node scripts/check-bundle-secrets.mjs [build dir] [--env=../capstoneconnectbackend/.env]
 *   (default build dir: .next/static; the portal: dist)
 *
 * Public by design: variables starting with NEXT_PUBLIC_ or VITE_ (they are compiled in).
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith("--")) || ".next/static");
// --env=<file>: also check the values of another env file (say, the API's) never reach the bundle.
const extraEnvFiles = args.filter((a) => a.startsWith("--env=")).map((a) => a.slice(6));
if (!fs.existsSync(root)) {
  console.error(`No build at ${root}: build first.`);
  process.exit(2);
}

const PATTERNS = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["AWS access key id", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ["Stripe-style live key", /\b(sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ["Slack token", /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/],
  ["signed JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b/],
  ["database URL with a password", /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^\s:@/"']+:[^\s@/"']+@/],
  ["server-only setting name", /\b(SECRET_KEY|DATABASE_URL|ADMIN_PASSWORD|GITHUB_TOKEN|SMS_API_KEY|AWS_SECRET_ACCESS_KEY|S3_SECRET_KEY|FIELD_ENCRYPTION_KEYS|BLIND_INDEX_KEY)\b/],
  // The demo mock API (seeded students, phones, chats) must never be in a real-backend build.
  ["demo mock data", /\bcapstone_users\b|Aarav Sharma|\bpassword123\b/],
];

/** Values of non-public variables in the local env files (and this process), at least 8 characters. */
function privateValues() {
  const found = new Map();
  const consider = (name, value) => {
    if (!name || /^(NEXT_PUBLIC_|VITE_)/.test(name)) return;
    const v = String(value ?? "").trim().replace(/^["']|["']$/g, "");
    if (v.length >= 8 && !/^(true|false|development|production|test|localhost|https?:\/\/localhost[:/\d]*)$/i.test(v)) found.set(v, name);
  };
  for (const file of [".env", ".env.local", ".env.production", ".env.production.local", ...extraEnvFiles]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) consider(m[1], m[2]);
    }
  }
  for (const name of ["SECRET_KEY", "DATABASE_URL", "ADMIN_PASSWORD", "GITHUB_TOKEN", "SMS_API_KEY", "AWS_SECRET_ACCESS_KEY"]) {
    consider(name, process.env[name]);
  }
  return found;
}

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (/\.(js|mjs|cjs|html|css|json|txt|map)$/.test(entry.name)) yield full;
  }
}

const secrets = privateValues();
const problems = [];
let scanned = 0;
for (const file of files(root)) {
  const text = fs.readFileSync(file, "utf8");
  scanned++;
  for (const [what, re] of PATTERNS) if (re.test(text)) problems.push(`${path.relative(root, file)}: ${what}`);
  for (const [value, name] of secrets) if (text.includes(value)) problems.push(`${path.relative(root, file)}: the value of ${name}`);
}

if (problems.length) {
  console.error(`Secret-like content in the browser bundle (${root}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`No secrets in ${scanned} files under ${path.relative(process.cwd(), root) || root} (checked ${PATTERNS.length} patterns and ${secrets.size} private values).`);
