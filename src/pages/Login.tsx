import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Button, ErrorNote, Field, Input } from "../components/ui";

/** The demo admin (demo builds only; the demo has no backend, so these aren't secrets). */
const DEMO_ADMIN =
  import.meta.env.VITE_DEMO_MODE === "true"
    ? { email: "demo@capstoneconnect.app", password: "demo-admin-2026" }
    : { email: "", password: "" }; // real builds: the demo login is not in the bundle

export function LoginPage() {
  const { admin, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (admin) return <Navigate to="/" replace />;

  const go = async (withEmail: string, withPassword: string) => {
    setBusy(true);
    setError(null);
    try {
      await signIn(withEmail, withPassword);
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await go(email, password);
  };

  /** Fills in the demo admin so the fields show what was used, then signs in. */
  const signInAsDemo = async () => {
    setEmail(DEMO_ADMIN.email);
    setPassword(DEMO_ADMIN.password);
    await go(DEMO_ADMIN.email, DEMO_ADMIN.password);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-400 text-sm font-bold text-slate-900">C</span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">CapstoneConnect Admin</h1>
            <p className="text-xs text-slate-500">Sign in to manage the site</p>
          </div>
        </div>
        {import.meta.env.VITE_DEMO_MODE === "true" ? (
          <div role="note" className="mb-5 flex gap-2.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-slate-700">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
            <div className="space-y-2">
              <p>
                <span className="font-semibold text-slate-900">This portal is in demo mode right now.</span> It runs on sample
                students and groups with no backend, and anything you change is kept only in this browser.
              </p>
              <p className="text-slate-600">
                Demo login: <span className="font-medium text-slate-900">{DEMO_ADMIN.email}</span>, password{" "}
                <span className="font-medium text-slate-900">{DEMO_ADMIN.password}</span>
              </p>
              <Button type="button" busy={busy} onClick={signInAsDemo} className="w-full">
                Sign in with the demo account
              </Button>
            </div>
          </div>
        ) : null}
        <div className="space-y-4">
          <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Password">
            {(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        </div>
        {error ? <div className="-mx-4 mt-2"><ErrorNote error={error} /></div> : null}
        <Button type="submit" variant="primary" busy={busy} className="mt-6 w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}
