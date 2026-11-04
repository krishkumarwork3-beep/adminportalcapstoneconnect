import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** The API's origin, from the same variable the app uses (src/lib/api.ts). */
function apiOrigin(mode: string): string {
  const env = loadEnv(mode, ".", "VITE_");
  return new URL(env.VITE_API_BASE_URL || "http://localhost:8000/api").origin;
}

/**
 * Content Security Policy for the portal. It is a static site, so the policy travels inside
 * index.html (a <meta> tag works on any host); frame-ancestors can't be set that way, so the
 * build also writes it in the hosts' header files (public/_headers, vercel.json) and `vite
 * preview` sends it. The API page frames the API's own docs (frame-src the API).
 */
function csp(api: string, forMeta: boolean): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${api}`,
    "font-src 'self' data:",
    `connect-src 'self' ${api}`,
    `frame-src ${api}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(forMeta ? [] : ["frame-ancestors 'none'"]),
  ].join("; ");
}

function securityHeaders(api: string): Record<string, string> {
  return {
    "Content-Security-Policy": csp(api, false),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };
}

function cspMeta(api: string): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp(api, true)}" />`);
    },
    generateBundle() {
      // Header files for hosts that read them (Netlify, Cloudflare Pages; Vercel uses vercel.json).
      const headers = securityHeaders(api);
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: `/*\n${Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`).join("\n")}\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const api = apiOrigin(mode);
  return {
    plugins: [react(), tailwindcss(), cspMeta(api)],
    server: { port: 3100, strictPort: true, headers: { "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff" } },
    // The built index.html carries the full policy for the API it was built for; the preview
    // server (which may run with other variables) only adds what a <meta> tag can't say.
    preview: {
      port: 3100,
      headers: { ...securityHeaders(api), "Content-Security-Policy": "frame-ancestors 'none'" },
    },
  };
});
