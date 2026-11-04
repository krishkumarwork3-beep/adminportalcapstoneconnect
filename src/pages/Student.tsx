import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, ShieldOff, ShieldX, Trash2 } from "lucide-react";
import { api, type StudentDetail } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTime, timeAgo } from "../lib/format";
import { safeHref } from "../lib/security/safe-url";
import { Badge, Button, Card, ConfirmDialog, ErrorNote, Field, Input, Modal, Spinner, Textarea, useToast, friendlyError } from "../components/ui";
import { StatusBadges } from "./Students";

type Form = { name: string; phone: string; college: string; department: string; passing_year: string; github_url: string; skills: string; bio: string };

const toForm = (s: StudentDetail): Form => ({
  name: s.name,
  phone: s.phone,
  college: s.college,
  department: s.department ?? "",
  passing_year: String(s.passing_year),
  github_url: s.github_url ?? "",
  skills: s.skills.join(", "),
  bio: s.bio,
});

export function StudentPage() {
  const { id = "" } = useParams();
  const { canEdit } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const student = useQuery({ queryKey: ["student", id], queryFn: () => api<StudentDetail>(`/users/${id}`) });
  const [form, setForm] = useState<Form | null>(null);
  const [dialog, setDialog] = useState<"password" | "ban" | "unban" | "delete" | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [blockNumber, setBlockNumber] = useState(false);
  const [removingFile, setRemovingFile] = useState<"avatar" | "resume" | null>(null);

  useEffect(() => {
    if (student.data) setForm(toForm(student.data));
  }, [student.data]);

  const refresh = (data?: StudentDetail) => {
    if (data) queryClient.setQueryData(["student", id], data);
    void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "student" });
  };
  const fail = (e: Error) => toast(friendlyError(e), "error");

  const save = useMutation({
    mutationFn: (f: Form) =>
      api<StudentDetail>(`/users/${id}`, {
        method: "PATCH",
        body: {
          name: f.name,
          phone: f.phone,
          college: f.college,
          department: f.department || null,
          passing_year: Number(f.passing_year),
          github_url: f.github_url || null,
          skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
          bio: f.bio,
        },
      }),
    onSuccess: (data) => {
      refresh(data);
      toast("Saved");
    },
    onError: fail,
  });
  const setPw = useMutation({
    mutationFn: () => api(`/users/${id}/password`, { method: "POST", body: { password } }),
    onSuccess: () => {
      toast("New password set. They have been signed out everywhere.");
      setDialog(null);
      setPassword("");
      refresh();
    },
    onError: fail,
  });
  const ban = useMutation({
    mutationFn: () => api<StudentDetail>(`/users/${id}/ban`, { method: "POST", body: { reason, block_number: blockNumber } }),
    onSuccess: (data) => {
      refresh(data);
      toast("Suspended. They have been signed out.");
      setDialog(null);
      setReason("");
      setBlockNumber(false);
    },
    onError: fail,
  });
  const unban = useMutation({
    mutationFn: () => api<StudentDetail>(`/users/${id}/unban`, { method: "POST" }),
    onSuccess: (data) => {
      refresh(data);
      toast("Suspension lifted");
      setDialog(null);
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Student deleted");
      void queryClient.invalidateQueries();
      navigate("/students");
    },
    onError: fail,
  });

  const removeFile = useMutation({
    mutationFn: (kind: "avatar" | "resume") => api<StudentDetail>(`/users/${id}/${kind}`, { method: "DELETE" }),
    onSuccess: (detail, kind) => {
      toast(kind === "avatar" ? "Photo removed" : "Résumé removed");
      setRemovingFile(null);
      queryClient.setQueryData(["student", id], detail);
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: fail,
  });

  if (student.isLoading || (student.data && !form)) return <Spinner />;
  if (student.error || !student.data || !form) return <ErrorNote error={student.error ?? "Not found"} />;
  const s = student.data;
  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(s));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(form);
  };

  return (
    <>
      <Link to="/students" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Students
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900">
            {s.name} <StatusBadges student={s} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {s.id} · joined {formatDateTime(s.created_at)} · last seen {timeAgo(s.last_seen)}
          </p>
          {s.banned ? (
            <p className="mt-2 text-sm text-red-700">
              Suspended {formatDateTime(s.banned_at)}
              {s.ban_reason ? `: ${s.ban_reason}` : ""}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog("password")}>
              <KeyRound className="h-4 w-4" /> Set password
            </Button>
            {s.banned ? (
              <Button onClick={() => setDialog("unban")}>
                <ShieldOff className="h-4 w-4" /> Lift suspension
              </Button>
            ) : (
              <Button onClick={() => setDialog("ban")}>
                <ShieldX className="h-4 w-4" /> Suspend
              </Button>
            )}
            <Button variant="danger" onClick={() => setDialog("delete")}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <form onSubmit={submit} className="grid gap-4 p-4 sm:grid-cols-2">
            <fieldset disabled={!canEdit} className="contents">
              <Field label="Full name">{(fid) => <Input id={fid} required value={form.name} onChange={set("name")} />}</Field>
              <Field label="Phone (their login)">{(fid) => <Input id={fid} required value={form.phone} onChange={set("phone")} />}</Field>
              <Field label="College">{(fid) => <Input id={fid} required value={form.college} onChange={set("college")} />}</Field>
              <Field label="Department">{(fid) => <Input id={fid} value={form.department} onChange={set("department")} />}</Field>
              <Field label="Graduation year">{(fid) => <Input id={fid} type="number" min={2000} max={2100} required value={form.passing_year} onChange={set("passing_year")} />}</Field>
              <Field label="GitHub" hint={s.github_url ? (s.github_verified ? `Verified · ${s.github_contribution_count ?? 0} contributions` : "Not verified yet") : undefined}>
                {(fid) => <Input id={fid} value={form.github_url} onChange={set("github_url")} placeholder="username or profile URL" />}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Skills" hint="Comma separated">{(fid) => <Input id={fid} value={form.skills} onChange={set("skills")} />}</Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Bio">{(fid) => <Textarea id={fid} maxLength={400} value={form.bio} onChange={set("bio")} />}</Field>
              </div>
            </fieldset>
            {canEdit ? (
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button disabled={!dirty} onClick={() => setForm(toForm(s))}>
                  Reset
                </Button>
                <Button type="submit" variant="primary" disabled={!dirty} busy={save.isPending}>
                  Save changes
                </Button>
              </div>
            ) : null}
          </form>
        </Card>

        <div className="space-y-4">
          <Card title="Group">
            <div className="p-4 text-sm">
              {s.group_id ? (
                <>
                  <Link to={`/groups/${s.group_id}`} className="font-medium text-slate-900 hover:underline">
                    {s.group_name}
                  </Link>
                  <div className="mt-1">
                    <Badge tone="blue">{s.group_role === "admin" ? "Group Lead" : "Member"}</Badge>
                  </div>
                </>
              ) : (
                <span className="text-slate-500">Not in a group (looking for a team)</span>
              )}
            </div>
          </Card>
          <Card title="Activity">
            <dl className="grid grid-cols-2 gap-px bg-slate-100 text-sm">
              {[
                ["Requests sent", s.requests_sent],
                ["Requests received", s.requests_received],
                ["Messages sent", s.messages_sent],
                ["Conversations", s.conversations],
              ].map(([label, value]) => (
                <div key={label} className="bg-white p-3">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {s.resume_url || s.avatar_url ? (
            <Card title="Files">
              <ul className="divide-y divide-slate-100 text-sm">
                {s.avatar_url ? (
                  <li className="flex items-center gap-3 px-4 py-3">
                    <img src={s.avatar_url} alt="" className="h-10 w-10 rounded-full border border-slate-200 object-cover" />
                    <a className="flex-1 text-orange-700 hover:underline" href={safeHref(s.avatar_url)} target="_blank" rel="noopener noreferrer">Profile photo</a>
                    {canEdit ? <Button size="sm" variant="ghost" onClick={() => setRemovingFile("avatar")}>Remove</Button> : null}
                  </li>
                ) : null}
                {s.resume_url ? (
                  <li className="flex items-center gap-3 px-4 py-3">
                    <a className="flex-1 text-orange-700 hover:underline" href={safeHref(s.resume_url)} target="_blank" rel="noopener noreferrer">Résumé (PDF)</a>
                    {canEdit ? <Button size="sm" variant="ghost" onClick={() => setRemovingFile("resume")}>Remove</Button> : null}
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={removingFile !== null}
        title={removingFile === "avatar" ? `Remove ${s.name}'s photo?` : `Remove ${s.name}'s résumé?`}
        message="The file is deleted from the server. They can upload a new one from their profile."
        confirmLabel="Remove"
        danger
        busy={removeFile.isPending}
        onConfirm={() => removingFile && removeFile.mutate(removingFile)}
        onClose={() => setRemovingFile(null)}
      />

      <Modal
        open={dialog === "password"}
        title={`Set a new password for ${s.name}`}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="primary" disabled={password.length < 8} busy={setPw.isPending} onClick={() => setPw.mutate()}>
              Set password
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">They are signed out on every device and sign in with this password. Share it with them securely.</p>
        <Field label="New password" hint="At least 8 characters">
          {(fid) => <Input id={fid} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}
        </Field>
      </Modal>

      <ConfirmDialog
        open={dialog === "ban"}
        title={`Suspend ${s.name}?`}
        message="They are signed out at once and can't sign in, reset their password or use chat until you lift the suspension."
        confirmLabel="Suspend"
        danger
        busy={ban.isPending}
        onConfirm={() => ban.mutate()}
        onClose={() => setDialog(null)}
      >
        <Field label="Reason (kept in the audit log)">{(fid) => <Input id={fid} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. spam messages" />}</Field>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5" checked={blockNumber} onChange={(e) => setBlockNumber(e.target.checked)} />
          Also block {s.phone}, so it can't be used to sign up again
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "unban"}
        title={`Lift the suspension of ${s.name}?`}
        message={s.number_blocked ? "Their number is also blocked: remove it under Blocked numbers too, or they still can't sign in." : "They can sign in again straight away."}
        confirmLabel="Lift suspension"
        busy={unban.isPending}
        onConfirm={() => unban.mutate()}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title={`Delete ${s.name}?`}
        message={
          <>
            This can't be undone. Their account, requests and chat memberships are removed; messages they sent stay in group chats.
            {s.group_role === "admin" ? " They lead a group: it passes to the longest-serving member (or closes if they are the last one)." : ""}
          </>
        }
        confirmLabel="Delete student"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
