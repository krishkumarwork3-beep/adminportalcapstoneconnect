import { useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Download, Plus, Search, Trash2 } from "lucide-react";
import { api, buildUrl, type Page, type Student, type StudentDetail } from "../lib/api";
import { useAuth } from "../lib/auth";
import { timeAgo } from "../lib/format";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, Modal, PageCheckbox, PageHeader, Pagination, Select, SelectionBar, Spinner, Table, Textarea, useDebounced, useSelection, useToast } from "../components/ui";

const PAGE_SIZE = 25;

export function StatusBadges({ student }: { student: Student }) {
  return (
    <span className="flex flex-wrap gap-1">
      {student.banned ? <Badge tone="red">Suspended</Badge> : null}
      {student.number_blocked ? <Badge tone="red">Number blocked</Badge> : null}
      {!student.banned && !student.number_blocked ? (
        student.group_id ? <Badge tone="blue">{student.group_role === "admin" ? "Group Lead" : "In a group"}</Badge> : <Badge tone="amber">Looking</Badge>
      ) : null}
    </span>
  );
}

export function StudentsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search);
  const status = params.get("status") ?? "all";
  const college = params.get("college") ?? "";
  const sort = params.get("sort") ?? "newest";
  const page = Number(params.get("page") ?? 1);
  const selection = useSelection();
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState<"ban" | "unban" | "delete" | null>(null);
  const [bulkReason, setBulkReason] = useState("");

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
    if (key !== "page") selection.clear();
  };

  const query = { q, status, college, sort, page, page_size: PAGE_SIZE };
  const students = useQuery({ queryKey: ["students", query], queryFn: () => api<Page<Student>>("/users", { query }), placeholderData: keepPreviousData });
  const colleges = useQuery({ queryKey: ["colleges"], queryFn: () => api<string[]>("/users/colleges") });

  const bulkAction = useMutation({
    mutationFn: () => api<{ done: number; skipped: string[] }>("/users/bulk", { method: "POST", body: { ids: selection.ids, action: bulk, reason: bulkReason } }),
    onSuccess: (result) => {
      toast(`${bulk === "ban" ? "Suspended" : bulk === "unban" ? "Lifted suspension of" : "Deleted"} ${result.done} student(s)`);
      setBulk(null);
      setBulkReason("");
      selection.clear();
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const items = students.data?.items ?? [];
  const exportUrl = buildUrl("/users/export.csv", { q, status, college });

  return (
    <>
      <PageHeader
        title="Students"
        description="Every account on the site. Click a student to edit, reset their password, suspend or delete them."
        actions={
          <>
            <a href={exportUrl}>
              <Button>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </a>
            {canEdit ? (
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add student
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setParam("q", e.target.value);
              }}
              placeholder="Search name, college, phone or id"
              className="pl-8"
              aria-label="Search students"
            />
          </div>
          <Select value={status} onChange={(e) => setParam("status", e.target.value)} className="w-auto" aria-label="Status">
            <option value="all">All students</option>
            <option value="active">Not suspended</option>
            <option value="banned">Suspended</option>
            <option value="in_group">In a group</option>
            <option value="looking">Looking for a team</option>
          </Select>
          <Select value={college} onChange={(e) => setParam("college", e.target.value)} className="w-auto max-w-56" aria-label="College">
            <option value="">All colleges</option>
            {(colleges.data ?? []).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setParam("sort", e.target.value)} className="w-auto" aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="last_seen">Recently active</option>
          </Select>
        </div>

        {canEdit ? (
          <SelectionBar selection={selection} total={students.data?.total ?? 0} noun="students" onSelectAll={() => api<string[]>("/users/ids", { query: { q, status, college } })}>
            <Button size="sm" onClick={() => setBulk("ban")}>Suspend</Button>
            <Button size="sm" onClick={() => setBulk("unban")}>Lift suspension</Button>
            <Button size="sm" variant="danger" onClick={() => setBulk("delete")}>
              <Trash2 className="h-4 w-4" /> Delete selected
            </Button>
          </SelectionBar>
        ) : null}

        {students.isLoading ? (
          <Spinner />
        ) : students.error ? (
          <ErrorNote error={students.error} />
        ) : items.length === 0 ? (
          <EmptyState>No students match these filters.</EmptyState>
        ) : (
          <Table
            head={
              <>
                {canEdit ? (
                  <th className="w-10">
                    <PageCheckbox selection={selection} ids={items.map((s) => s.id)} />
                  </th>
                ) : null}
                <th>Student</th>
                <th>Phone</th>
                <th>College</th>
                <th>Group</th>
                <th>Status</th>
                <th>Last seen</th>
              </>
            }
          >
            {items.map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/students/${s.id}`)}>
                {canEdit ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selection.has(s.id)} onChange={() => selection.toggle(s.id)} aria-label={`Select ${s.name}`} />
                  </td>
                ) : null}
                <td>
                  <Link to={`/students/${s.id}`} className="font-medium text-slate-900 hover:underline" onClick={(e) => e.stopPropagation()}>
                    {s.name}
                  </Link>
                  <div className="text-xs text-slate-400">{s.id}</div>
                </td>
                <td className="whitespace-nowrap tabular-nums">{s.phone}</td>
                <td>
                  <div className="max-w-56 truncate">{s.college}</div>
                  <div className="text-xs text-slate-400">Class of {s.passing_year}</div>
                </td>
                <td className="max-w-44 truncate">{s.group_name ?? <span className="text-slate-400">—</span>}</td>
                <td>
                  <StatusBadges student={s} />
                </td>
                <td className="whitespace-nowrap text-slate-500">{timeAgo(s.last_seen)}</td>
              </tr>
            ))}
          </Table>
        )}
        {students.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={students.data.total} onPage={(p) => setParam("page", String(p))} /> : null}
      </Card>

      <AddStudent open={adding} onClose={() => setAdding(false)} />

      <ConfirmDialog
        open={bulk !== null}
        title={bulk === "delete" ? `Delete ${selection.size} student(s)?` : bulk === "ban" ? `Suspend ${selection.size} student(s)?` : `Lift ${selection.size} suspension(s)?`}
        message={
          bulk === "delete"
            ? "Their accounts, requests and chat memberships are removed for good. Group Leads hand their group to the longest-serving member."
            : bulk === "ban"
              ? "They are signed out at once and can't sign in until the suspension is lifted."
              : "They can sign in again (a blocked number stays blocked)."
        }
        confirmLabel={bulk === "delete" ? "Delete" : bulk === "ban" ? "Suspend" : "Lift suspension"}
        danger={bulk !== "unban"}
        busy={bulkAction.isPending}
        onConfirm={() => bulkAction.mutate()}
        onClose={() => setBulk(null)}
      >
        {bulk === "ban" ? <Field label="Reason (optional, shown in the audit log)">{(id) => <Input id={id} value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />}</Field> : null}
      </ConfirmDialog>
    </>
  );
}

function AddStudent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const empty = { name: "", college: "", department: "", passing_year: String(new Date().getFullYear() + 1), phone: "", password: "", github_url: "", skills: "", bio: "" };
  const [form, setForm] = useState(empty);
  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = useMutation({
    mutationFn: () =>
      api<StudentDetail>("/users", {
        method: "POST",
        body: {
          ...form,
          department: form.department || null,
          github_url: form.github_url || null,
          passing_year: Number(form.passing_year),
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: (student) => {
      toast(`Added ${student.name}`);
      setForm(empty);
      onClose();
      void queryClient.invalidateQueries();
      navigate(`/students/${student.id}`);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <Modal open={open} title="Add a student" onClose={onClose} wide>
      <form id="add-student" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">{(id) => <Input id={id} required value={form.name} onChange={set("name")} />}</Field>
        <Field label="Phone" hint="Any format; it is also their login">{(id) => <Input id={id} required value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />}</Field>
        <Field label="College">{(id) => <Input id={id} required value={form.college} onChange={set("college")} />}</Field>
        <Field label="Department">{(id) => <Input id={id} value={form.department} onChange={set("department")} />}</Field>
        <Field label="Graduation year">{(id) => <Input id={id} type="number" min={2000} max={2100} required value={form.passing_year} onChange={set("passing_year")} />}</Field>
        <Field label="Password" hint="At least 8 characters; share it with them securely">
          {(id) => <Input id={id} type="text" minLength={8} required value={form.password} onChange={set("password")} autoComplete="new-password" />}
        </Field>
        <Field label="GitHub (optional)">{(id) => <Input id={id} value={form.github_url} onChange={set("github_url")} placeholder="username or profile URL" />}</Field>
        <Field label="Skills (optional)" hint="Comma separated">{(id) => <Input id={id} value={form.skills} onChange={set("skills")} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Bio (optional)">{(id) => <Textarea id={id} maxLength={400} value={form.bio} onChange={set("bio")} />}</Field>
        </div>
      </form>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="add-student" variant="primary" busy={create.isPending}>
          Add student
        </Button>
      </div>
    </Modal>
  );
}
