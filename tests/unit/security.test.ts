// Run with `npm run test:unit` (node --test; Node strips the types itself).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseJson } from "../../src/lib/security/json.ts";
import { safeHref } from "../../src/lib/security/safe-url.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

function sources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|js)$/.test(entry.name)) out.push({ file: path.relative(ROOT, full).replaceAll("\\", "/"), text: fs.readFileSync(full, "utf8") });
    }
  };
  walk(path.join(ROOT, "src"));
  out.push({ file: "index.html", text: fs.readFileSync(path.join(ROOT, "index.html"), "utf8") });
  return out;
}

test("the portal and the site share the same link checks", () => {
  const site = path.join(ROOT, "../3dcapconnectfrontend/lib/security");
  if (!fs.existsSync(site)) return; // the portal checked out on its own
  for (const name of ["safe-url.ts", "json.ts"]) {
    assert.equal(fs.readFileSync(path.join(ROOT, "src/lib/security", name), "utf8"), fs.readFileSync(path.join(site, name), "utf8"), name);
  }
});

test("safeHref refuses scripts and look-alike links, keeps ordinary ones", () => {
  for (const link of ["javascript:alert(1)", "data:text/html,x", "//evil.example", "/\\evil.example", "https://a@evil.example", "java\tscript:x", "vbscript:x"]) {
    assert.equal(safeHref(link), undefined, link);
  }
  assert.equal(safeHref("http://localhost:8000/api/files/att_0123456789abcdef.pdf"), "http://localhost:8000/api/files/att_0123456789abcdef.pdf");
});

test("API answers can't pollute Object.prototype", () => {
  const data = parseJson<Record<string, unknown>>('{"__proto__":{"isAdmin":true},"message":"x"}');
  Object.assign({}, data);
  assert.equal(({} as Record<string, unknown>).isAdmin, undefined);
  assert.equal(data.message, "x");
});

test("no raw HTML sinks or string evaluation", () => {
  const sink = /dangerouslySetInnerHTML|\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write|new Function\(|\beval\(|srcdoc/;
  assert.deepEqual(sources().filter((f) => sink.test(f.text)).map((f) => f.file), []);
});

test("every new-tab link has rel=\"noopener noreferrer\"", () => {
  const bad: string[] = [];
  for (const { file, text } of sources()) {
    for (const m of text.matchAll(/target(=|:\s*)["']_blank["']/g)) {
      const region = text.slice(Math.max(0, m.index - 300), m.index + 300);
      if (!/noopener noreferrer/.test(region)) bad.push(`${file}:${text.slice(0, m.index).split("\n").length}`);
    }
  }
  assert.deepEqual(bad, []);
});

const INTERNAL_HREFS = new Set(["l.href", "`${API_ORIGIN}/docs`", "exportUrl"]);

test("every href built from data goes through safeHref", () => {
  const bad: string[] = [];
  for (const { file, text } of sources()) {
    for (const m of text.matchAll(/\bhref=\{/g)) {
      let depth = 0;
      let end = m.index + m[0].length - 1;
      for (; end < text.length; end++) {
        if (text[end] === "{") depth++;
        else if (text[end] === "}" && --depth === 0) break;
      }
      const expr = text.slice(m.index + m[0].length, end).trim();
      if (!(/^["'`]\//.test(expr) || expr.startsWith("safeHref(") || INTERNAL_HREFS.has(expr))) bad.push(`${file}: href={${expr}}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("no cross-window messaging; redirects after log-in come only from in-app state", () => {
  const all = sources();
  assert.deepEqual(all.filter((f) => /postMessage\(|addEventListener\(\s*["']message["']|document\.all\b/.test(f.text)).map((f) => f.file), []);
  // The log-in page goes back to `location.state.from`, which only the app's own <Navigate> sets
  // (never the URL), so there is no ?next= to abuse.
  const login = all.find((f) => f.file === "src/pages/Login.tsx")!.text;
  assert.doesNotMatch(login, /searchParams|URLSearchParams|location\.search|window\.location\s*=/);
});

test("the portal never shows raw error text or stack traces", () => {
  const bad: string[] = [];
  for (const { file, text } of sources()) {
    for (const m of text.matchAll(/\b(e|err|error|exc)\.(message|stack)\b/g)) {
      const line = text.slice(text.lastIndexOf("\n", m.index) + 1, text.indexOf("\n", m.index));
      if (!/friendlyError|error\.message\.slice|instanceof kind|!error\.message/.test(line)) bad.push(`${file}: ${line.trim()}`);
    }
  }
  assert.deepEqual(bad, []);
});
