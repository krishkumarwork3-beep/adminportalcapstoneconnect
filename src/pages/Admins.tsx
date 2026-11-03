import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, type Admin, type AdminRole } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTime, timeAgo } from "../lib/format";
import { Badge, Button, Card, ConfirmDialog, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table, useToast } from "../components/ui";

export function AdminsPage() {
  const { admin: me, canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const admins = useQuery({ queryKey: ["admins"], queryFn: () => api<Admin[]>("/admins") });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Admin | null>(null);
  const done = (text: string) => () => {
    toast(text);
    void queryClient.invalidateQueries({ queryKey: ["admins"] });
  };
  const fail = (e: Error) => toast(e.message, "error");

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Pick<Admin, "role" | "active">> }) => api<Admin>(`/admins/${id}`, { method: "PATCH", body }),
    onSuccess: done("Updated"),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admins/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      done("Admin removed")();
      setRemoving(null);
    },
    onError: fail,
  });

  return (
    <>
      <PageHeader
        title="Admins"
        description="People who can use this portal. Admins can change anything; read-only accounts can only look."
        actions={canEdit ? <Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add admin</Button> : null}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {admins.isLoading ? (
            <Spinner />
          ) : admins.error ? (
            <ErrorNote error={admins.error} />
          ) : (
            <Table head={<><th>Admin</th><th>Access</th><th>Status</th><th>Last sign-in</th>{canEdit ? <th /> : null}</>}>
              {admins.data?.map((a) => {
                const self = a.id === me?.id;
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium">{a.name} {self ? <span className="text-xs text-slate-400">(you)</span> : null}</div>
                      <div className="text-xs text-slate-500">{a.email}</div>
                    </td>
                    <td>
                      {canEdit && !self ? (
                        <Select value={a.role} onChange={(e) => update.mutate({ id: a.id, body: { role: e.target.value as AdminRole } })} className="h-8 w-auto text-[13px]" aria-label={`Access for ${a.name}`}>
                          <option value="admin">Admin</option>
                          <option value="viewer">Read-only</option>
                        </Select>
                      ) : (
                        <Badge tone={a.role === "admin" ? "orange" : "gray"}>{a.role === "admin" ? "Admin" : "Read-only"}</Badge>
                      )}
                    </td>
                    <td>{a.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</td>
                    <td className="whitespace-nowrap text-slate-500" title={formatDateTime(a.last_login_at)}>{timeAgo(a.last_login_at)}</td>
                    {canEdit ? (
                      <td className="text-right whitespace-nowrap">
                        {!self ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: a.id, body: { active: !a.active } })}>
                              {a.active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-700" onClick={() => setRemoving(a)}>Remove</Button>
                          </>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
        <ChangePassword />
      </div>

      <AddAdmin open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name}?`}
        message={`${removing?.email} can no longer sign in to the portal. Their past actions stay in the audit log.`}
        confirmLabel="Remove admin"
        danger
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

function AddAdmin({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" as AdminRole });
  const create = useMutation({
    mutationFn: () => api<Admin>("/admins", { method: "POST", body: form }),
    onSuccess: (a) => {
      toast(`Added ${a.email}`);
      setForm({ name: "", email: "", password: "", role: "admin" });
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e) => toast(e.message, "error"),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  return (
    <Modal open={open} title="Add an admin" onClose={onClose}>
      <form id="add-admin" onSubmit={submit} className="space-y-4">
        <Field label="Name">{(id) => <Input id={id} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Email (their sign-in)">{(id) => <Input id={id} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Password" hint="At least 8 characters; they can change it after signing in">
          {(id) => <Input id={id} minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />}
        </Field>
        <Field label="Access">
          {(id) => (
            <Select id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>
              <option value="admin">Admin: can change anything</option>
              <option value="viewer">Read-only: can look, not change</option>
            </Select>
          )}
        </Field>
      </form>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="add-admin" variant="primary" busy={create.isPending}>Add admin</Button>
      </div>
    </Modal>
  );
}

function ChangePassword() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: () => api("/auth/password", { method: "POST", body: { current_password: current, new_password: next } }),
    onSuccess: () => {
      toast("Password changed. Your other sessions have been signed out.");
      setCurrent("");
      setNext("");
    },
    onError: (e) => toast(e.message, "error"),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    change.mutate();
  };
  return (
    <Card title="Your password">
      <form onSubmit={submit} className="space-y-4 p-4">
        <Field label="Current password">{(id) => <Input id={id} type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}</Field>
        <Field label="New password" hint="At least 8 characters">
          {(id) => <Input id={id} type="password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}
        </Field>
        <Button type="submit" variant="primary" busy={change.isPending} className="w-full">Change password</Button>
      </form>
    </Card>
  );
}
