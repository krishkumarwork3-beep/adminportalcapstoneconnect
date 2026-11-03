import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Trash2, UserMinus } from "lucide-react";
import { api, type GroupDetail, type GroupRow, type Page } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, formatDateTime } from "../lib/format";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Input, PageHeader, Pagination, Select, Spinner, Table, useDebounced, useToast } from "../components/ui";

const PAGE_SIZE = 25;

export function GroupsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const query = { q, status, page, page_size: PAGE_SIZE };
  const groups = useQuery({ queryKey: ["groups", query], queryFn: () => api<Page<GroupRow>>("/groups", { query }), placeholderData: keepPreviousData });

  return (
    <>
      <PageHeader title="Groups" description="Capstone teams. Open a group to see its members, remove someone or delete the group." />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, domain or id" className="pl-8" aria-label="Search groups" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Status">
            <option value="all">All groups</option>
            <option value="open">Has open seats</option>
            <option value="full">Full</option>
          </Select>
        </div>
        {groups.isLoading ? (
          <Spinner />
        ) : groups.error ? (
          <ErrorNote error={groups.error} />
        ) : groups.data?.items.length === 0 ? (
          <EmptyState>No groups match.</EmptyState>
        ) : (
          <Table head={<><th>Group</th><th>Domain</th><th>Group Lead</th><th>Seats</th><th>Created</th></>}>
            {groups.data?.items.map((g) => (
              <tr key={g.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/groups/${g.id}`)}>
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
            <Button variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" /> Delete group
            </Button>
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
                  <td className="text-right">
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
