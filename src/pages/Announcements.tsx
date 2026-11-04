import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus } from "lucide-react";
import { api, type AnnouncementRow } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTime } from "../lib/format";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table, Textarea, useToast } from "../components/ui";

type Form = { text: string; link_url: string; link_label: string; level: "info" | "warning"; starts_at: string; ends_at: string };
const empty: Form = { text: "", link_url: "", link_label: "", level: "info", starts_at: "", ends_at: "" };

/** <input type="datetime-local"> works in local time without a zone; the API wants ISO with one. */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

/** The banner on the student site: text, an optional link, when it shows, info or warning. */
export function AnnouncementsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["announcements"], queryFn: () => api<AnnouncementRow[]>("/announcements") });
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementRow | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const f = editing!.form;
      const body = {
        text: f.text.trim(),
        link_url: f.link_url.trim() || null,
        link_label: f.link_label.trim() || null,
        level: f.level,
        starts_at: fromLocalInput(f.starts_at),
        ends_at: fromLocalInput(f.ends_at),
      };
      return editing!.id
        ? api<AnnouncementRow>(`/announcements/${editing!.id}`, { method: "PATCH", body })
        : api<AnnouncementRow>("/announcements", { method: "POST", body });
    },
    onSuccess: () => {
      toast(editing?.id ? "Announcement saved" : "Announcement posted");
      setEditing(null);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Announcement deleted");
      setDeleting(null);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  const set = (key: keyof Form) => (e: { target: { value: string } }) => setEditing((s) => s && { ...s, form: { ...s.form, [key]: e.target.value } });

  return (
    <>
      <PageHeader
        title="Announcements"
        description="A banner across the top of the student site, in 3D and normal mode. Students can dismiss it."
        actions={canEdit ? <Button variant="primary" onClick={() => setEditing({ id: null, form: empty })}><Plus className="h-4 w-4" /> New announcement</Button> : null}
      />
      <Card>
        {list.isLoading ? (
          <Spinner />
        ) : list.error ? (
          <ErrorNote error={list.error} />
        ) : list.data?.length === 0 ? (
          <EmptyState>
            <Megaphone className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden />
            No announcements yet.
          </EmptyState>
        ) : (
          <Table head={<><th>Text</th><th>Level</th><th>Shows</th><th>By</th>{canEdit ? <th /> : null}</>}>
            {list.data?.map((a) => (
              <tr key={a.id} className="align-top">
                <td className="max-w-md">
                  <p className="break-words">{a.text}</p>
                  {a.link_url ? <p className="mt-1 text-xs text-slate-500">{a.link_label || "Learn more"} → {a.link_url}</p> : null}
                </td>
                <td><Badge tone={a.level === "warning" ? "amber" : "blue"}>{a.level}</Badge></td>
                <td className="whitespace-nowrap text-slate-600">
                  {a.active ? <Badge tone="green">showing now</Badge> : null}
                  <div className="text-xs">from {formatDateTime(a.starts_at)}</div>
                  <div className="text-xs">{a.ends_at ? `until ${formatDateTime(a.ends_at)}` : "no end"}</div>
                </td>
                <td className="text-slate-500">{a.created_by}</td>
                {canEdit ? (
                  <td className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: a.id, form: { text: a.text, link_url: a.link_url ?? "", link_label: a.link_label ?? "", level: a.level, starts_at: toLocalInput(a.starts_at), ends_at: toLocalInput(a.ends_at) } })}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(a)}>Delete</Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={editing !== null} title={editing?.id ? "Edit announcement" : "New announcement"} onClose={() => setEditing(null)} wide>
        {editing ? (
          <form id="announcement" className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <div className="sm:col-span-2">
              <Field label="Text" hint={`${editing.form.text.length} of 300 characters`}>{(fid) => <Textarea id={fid} required maxLength={300} value={editing.form.text} onChange={set("text")} />}</Field>
            </div>
            <Field label="Link (optional)" hint="https://… or a page of the site, like /groups">{(fid) => <Input id={fid} value={editing.form.link_url} onChange={set("link_url")} placeholder="https://" />}</Field>
            <Field label="Link text">{(fid) => <Input id={fid} maxLength={60} value={editing.form.link_label} onChange={set("link_label")} placeholder="Learn more" />}</Field>
            <Field label="Level">{(fid) => <Select id={fid} value={editing.form.level} onChange={set("level")}><option value="info">Info</option><option value="warning">Warning</option></Select>}</Field>
            <div />
            <Field label="Starts" hint="Empty: now">{(fid) => <Input id={fid} type="datetime-local" value={editing.form.starts_at} onChange={set("starts_at")} />}</Field>
            <Field label="Ends" hint="Empty: until you delete it">{(fid) => <Input id={fid} type="datetime-local" value={editing.form.ends_at} onChange={set("ends_at")} />}</Field>
          </form>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="announcement" variant="primary" busy={save.isPending}>{editing?.id ? "Save" : "Post"}</Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this announcement?"
        message="It disappears from the student site."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
