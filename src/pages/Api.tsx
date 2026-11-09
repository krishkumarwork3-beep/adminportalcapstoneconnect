import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { API_BASE_URL, API_ORIGIN } from "../lib/api";
import { Badge, Button, Card, PageHeader } from "../components/ui";
import { parseJson } from "../lib/security/json";

/** Health of the API, timed: GET /api/health. */
function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const started = performance.now();
      const response = await fetch(`${API_BASE_URL}/health`);
      const body = await response.text().then((t) => (t ? parseJson<{ status?: string }>(t) : {})).catch(() => ({} as { status?: string }));
      return { ok: response.ok && body.status === "ok", ms: Math.round(performance.now() - started) };
    },
    refetchInterval: 15_000,
    retry: false,
  });
}

export function ApiPage() {
  const health = useHealth();
  const links = [
    { label: "Swagger UI", href: `${API_ORIGIN}/docs`, note: "Try every endpoint in the browser" },
    { label: "ReDoc", href: `${API_ORIGIN}/redoc`, note: "Readable reference" },
    { label: "OpenAPI JSON", href: `${API_ORIGIN}/openapi.json`, note: "For Postman, Insomnia or code generators" },
  ];

  return (
    <>
      <PageHeader title="API & docs" description="Test the backend's endpoints with FastAPI's interactive docs." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Backend">
          <div className="space-y-2 p-4 text-sm">
            <p className="flex items-center gap-2">
              {health.isLoading ? <Badge>Checking…</Badge> : health.data?.ok ? <Badge tone="green">Online</Badge> : <Badge tone="red">Unreachable</Badge>}
              {health.data ? <span className="text-slate-500">{health.data.ms} ms</span> : null}
            </p>
            <p className="break-all text-slate-600">{API_BASE_URL}</p>
          </div>
        </Card>
        <Card title="Documentation" className="md:col-span-2">
          <ul className="divide-y divide-slate-100">
            {links.map((l) => (
              <li key={l.href} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  <span className="text-sm font-medium">{l.label}</span>
                  <span className="block text-xs text-slate-500">{l.note}</span>
                </span>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  <Button size="sm">
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="How signing in works in the docs" className="mt-4">
        <ul className="list-disc space-y-1.5 py-4 pr-4 pl-9 text-sm text-slate-700">
          <li>
            <strong>Admin endpoints</strong> (the “admin:” sections): you are already signed in. The docs run on the same host as the API, so
            your admin session cookie is sent with every “Try it out”.
          </li>
          <li>
            <strong>Student endpoints</strong>: call <code className="rounded bg-slate-100 px-1">POST /api/auth/login</code> with a student's phone and
            password (on a development database, the seeded students' demo password is in the backend README); later calls run as that student.
          </li>
          <li>Changes made through the docs are real: they hit the same database as the site.</li>
        </ul>
      </Card>

      <Card title="Swagger UI" className="mt-4" actions={<a className="text-xs text-orange-700 hover:underline" href={`${API_ORIGIN}/docs`} target="_blank" rel="noopener noreferrer">Open in a new tab</a>}>
        <iframe title="API documentation" src={`${API_ORIGIN}/docs`} className="h-[75vh] w-full rounded-b-lg" />
      </Card>
    </>
  );
}
