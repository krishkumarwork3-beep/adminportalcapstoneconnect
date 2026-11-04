import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Pencil, Search, Trash2, UserMinus } from "lucide-react";
import { api, type GroupDetail, type GroupRow, type Page } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, formatDateTime } from "../lib/format";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, Modal, PageCheckbox, Textarea, PageHeader, Pagination, Select, SelectionBar, Spinner, Table, useDebounced, useSelection, useToast } from "../components/ui";

const PAGE_SIZE = 25;

export function GroupsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const selection = useSelection();
  const [deleting, setDeleting] = useState(false);
  const query = { q, status, page, page_size: PAGE_SIZE };
  const groups = useQuery({ queryKey: ["groups", query], queryFn: () => api<Page<GroupRow>>("/groups", { query }), placeholderData: keepPreviousData });
  const items = groups.data?.items ?? [];

  const destroy = useMutation({
    mutationFn: () => api<{ done: number }>("/groups/bulk-delete", { method: "POST", body: { ids: selection.ids } }),
    onSuccess: (r) => {
      toast(`Deleted ${r.done} group(s)`);
      setDeleting(false);
      selection.clear();
      setPage(1);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <>
      <PageHeader title="Groups" description="Capstone teams. Open a group to see its members, remove someone or delete the group." />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); selection.clear(); }} placeholder="Search name, domain or id" className="pl-8" aria-label="Search groups" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); selection.clear(); }} className="w-auto" aria-label="Status">
            <option value="all">All groups</option>
            <option value="open">Has open seats</option>
            <option value="full">Full</option>
          </Select>
        </div>
        {canEdit ? (
          <SelectionBar selection={selection} total={groups.data?.total ?? 0} noun="groups" onSelectAll={() => api<string[]>("/groups/ids", { query: { q, status } })}>
            <Button size="sm" variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" /> Delete selected
            </Button>
          </SelectionBar>
        ) : null}
        {groups.isLoading ? (
          <Spinner />
        ) : groups.error ? (
          <ErrorNote error={groups.error} />
        ) : items.length === 0 ? (
          <EmptyState>No groups match.</EmptyState>
        ) : (
          <Table head={<>{canEdit ? <th className="w-10"><PageCheckbox selection={selection} ids={items.map((g) => g.id)} /></th> : null}<th>Group</th><th>Domain</th><th>Group Lead</th><th>Seats</th><th>Created</th></>}>
            {items.map((g) => (
              <tr key={g.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/groups/${g.id}`)}>
                {canEdit ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selection.has(g.id)} onChange={() => selection.toggle(g.id)} aria-label={`Select ${g.name}`} />
                  </td>
                ) : null}
                <td>
                  <Link to={`/groups/${g.id}`} className="font-medium text-slate-900 hover:underline" onClick={(e) => e.stopPropagation()}>{g.name}</Link>
                  <div className="text-xs text-slate-400">{g.id}</div>
                </td>
                <td>{g.domain}</td>
                <td>{g.lead_name ?? <span className="text-slate-400">—</span>}</td>
                <td>
                  <Badge tone={g.member_count >= g.max_members ? "gray" : "green"}>
                    {g.member_count} / {g.max_members}
                  </Badge>
                </td>
                <td className="whitespace-nowrap text-slate-500">{formatDate(g.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
        {groups.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={groups.data.total} onPage={setPage} /> : null}
      </Card>
      <ConfirmDialog
        open={deleting}
        title={`Delete ${selection.size} group(s)?`}
        message="Each group and its group chat are deleted, their pending requests are cancelled, and every member becomes free to join another group. This can't be undone."
        confirmLabel="Delete groups"
        danger
        busy={destroy.isPending}
        onConfirm={() => destroy.mutate()}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}

export function GroupPage() {
  const { id = "" } = useParams();
  const { canEdit } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const group = useQuery({ queryKey: ["group", id], queryFn: () => api<GroupDetail>(`/groups/${id}`) });
  const [removing, setRemoving] = useState<{ user_id: string; name: string; role: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<{ name: string; description: string; domain: string; requirements: string } | null>(null);
  const [newLead, setNewLead] = useState<{ user_id: string; name: string } | null>(null);

  const saveEdit = useMutation({
    mutationFn: () =>
      api<GroupDetail>(`/groups/${id}`, {
        method: "PATCH",
        body: editing && { ...editing, requirements: editing.requirements.split(",").map((r) => r.trim()).filter(Boolean) },
      }),
    onSuccess: (detail) => {
      toast("Group saved");
      setEditing(null);
      queryClient.setQueryData(["group", id], detail);
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast(e.message, "error"),
  });
  const makeLead = useMutation({
    mutationFn: (userId: string) => api<GroupDetail>(`/groups/${id}/lead`, { method: "POST", body: { user_id: userId } }),
    onSuccess: (detail) => {
      toast(`${newLead?.name} is now the Group Lead`);
      setNewLead(null);
      queryClient.setQueryData(["group", id], detail);
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast(e.message, "error"),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api(`/groups/${id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast(`Removed ${removing?.name}`);
      setRemoving(null);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });
  const destroy = useMutation({
    mutationFn: () => api(`/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Group deleted");
      void queryClient.invalidateQueries();
      navigate("/groups");
    },
    onError: (e) => toast(e.message, "error"),
  });

  if (group.isLoading) return <Spinner />;
  if (group.error || !group.data) return <ErrorNote error={group.error ?? "Not found"} />;
  const g = group.data;

  return (
    <>
      <Link to="/groups" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Groups
      </Link>
      <PageHeader
        title={g.name}
        description={`${g.domain} · ${g.member_count} of ${g.max_members} seats · ${g.pending_requests} pending requests · created ${formatDate(g.created_at)}`}
        actions={
          canEdit ? (
            <>
              <Button onClick={() => setEditing({ name: g.name, description: g.description, domain: g.domain, requirements: g.requirements.join(", ") })}>
                <Pencil className="h-4 w-4" /> Edit group
              </Button>
              <Button variant="danger" onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" /> Delete group
              </Button>
            </>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Members" className="lg:col-span-2">
          <Table head={<><th>Name</th><th>Phone</th><th>Role</th><th>Joined</th>{canEdit ? <th /> : null}</>}>
            {g.members.map((m) => (
              <tr key={m.user_id}>
                <td><Link to={`/students/${m.user_id}`} className="font-medium hover:underline">{m.name}</Link></td>
                <td className="tabular-nums">{m.phone}</td>
                <td>{m.role === "admin" ? <Badge tone="orange">Group Lead</Badge> : <Badge>Member</Badge>}</td>
                <td className="whitespace-nowrap text-slate-500">{formatDateTime(m.joined_at)}</td>
                {canEdit ? (
                  <td className="text-right whitespace-nowrap">
                    {m.role !== "admin" ? (
                      <Button size="sm" variant="ghost" onClick={() => setNewLead(m)}>
                        <Crown className="h-4 w-4" /> Make lead
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>
                      <UserMinus className="h-4 w-4" /> Remove
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="About">
          <div className="space-y-3 p-4 text-sm text-slate-700">
            <p className="whitespace-pre-wrap">{g.description}</p>
            {g.requirements.length ? (
              <div className="flex flex-wrap gap-1">
                {g.requirements.map((r) => <Badge key={r}>{r}</Badge>)}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name} from ${g.name}?`}
        message={removing?.role === "admin" ? "They are the Group Lead: the longest-serving member becomes the new lead (the group closes if they are the last member)." : "They become free to join another group."}
        confirmLabel="Remove"
        danger
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.user_id)}
        onClose={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={newLead !== null}
        title={`Make ${newLead?.name} the Group Lead?`}
        message={`They can then accept requests, invite and manage ${g.name}. The current lead stays in the group as a member.`}
        confirmLabel="Make lead"
        busy={makeLead.isPending}
        onConfirm={() => newLead && makeLead.mutate(newLead.user_id)}
        onClose={() => setNewLead(null)}
      />
      <Modal open={editing !== null} title={`Edit ${g.name}`} onClose={() => setEditing(null)} wide>
        {editing ? (
          <form id="edit-group" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); saveEdit.mutate(); }}>
            <Field label="Name">{(fid) => <Input id={fid} required maxLength={160} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />}</Field>
            <Field label="Domain">{(fid) => <Input id={fid} required maxLength={160} value={editing.domain} onChange={(e) => setEditing({ ...editing, domain: e.target.value })} />}</Field>
            <Field label="Description">{(fid) => <Textarea id={fid} rows={4} maxLength={2000} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />}</Field>
            <Field label="Looking for (skills)" hint="Comma separated">{(fid) => <Input id={fid} value={editing.requirements} onChange={(e) => setEditing({ ...editing, requirements: e.target.value })} />}</Field>
            <p className="text-xs text-slate-500">The group size ({g.max_members} seats) can't be changed.</p>
          </form>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="edit-group" variant="primary" busy={saveEdit.isPending}>Save</Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={deleting}
        title={`Delete ${g.name}?`}
        message="The group and its group chat are deleted, its pending requests are cancelled, and every member becomes free to join another group. This can't be undone."
        confirmLabel="Delete group"
        danger
        busy={destroy.isPending}
        onConfirm={() => destroy.mutate()}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}
