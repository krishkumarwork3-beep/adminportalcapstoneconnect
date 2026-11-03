import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type Page, type RequestRow } from "../lib/api";
import { useAuth } from "../lib/auth";
import { timeAgo } from "../lib/format";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, PageCheckbox, PageHeader, Pagination, Select, SelectionBar, Spinner, Table, useSelection, useToast } from "../components/ui";

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, "amber" | "green" | "red" | "gray"> = { pending: "amber", accepted: "green", declined: "red" };

export function RequestsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const selection = useSelection();
  const [cancelling, setCancelling] = useState(false);
  const query = { status, type, page, page_size: PAGE_SIZE };
  const requests = useQuery({ queryKey: ["requests", query], queryFn: () => api<Page<RequestRow>>("/requests", { query }), placeholderData: keepPreviousData });
  // Only pending requests can be cancelled, so only they can be selected.
  const pendingCount = useQuery({ queryKey: ["requests", { status: "pending", type, page: 1, page_size: 1 }], queryFn: () => api<Page<RequestRow>>("/requests", { query: { status: "pending", type, page: 1, page_size: 1 } }) });
  const pendingOnPage = (requests.data?.items ?? []).filter((r) => r.status === "pending").map((r) => r.id);
  const cancelSelected = useMutation({
    mutationFn: () => api<{ done: number; skipped: string[] }>("/requests/bulk-cancel", { method: "POST", body: { ids: selection.ids } }),
    onSuccess: (r) => {
      toast(`Cancelled ${r.done} request(s)${r.skipped.length ? ` · ${r.skipped.length} no longer pending` : ""}`);
      setCancelling(false);
      selection.clear();
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/requests/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast("Request cancelled");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <>
      <PageHeader title="Requests" description="Join requests (student → group) and invitations (Group Lead → student)." />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); selection.clear(); }} className="w-auto" aria-label="Status">
            <option value="all">Any status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); selection.clear(); }} className="w-auto" aria-label="Type">
            <option value="all">Requests and invitations</option>
            <option value="join_request">Join requests</option>
            <option value="invitation">Invitations</option>
          </Select>
        </div>
        {canEdit && (status === "all" || status === "pending") ? (
          <SelectionBar selection={selection} total={pendingCount.data?.total ?? 0} noun="pending requests" onSelectAll={() => api<string[]>("/requests/ids", { query: { type } })}>
            <Button size="sm" variant="danger" onClick={() => setCancelling(true)}>Cancel selected</Button>
          </SelectionBar>
        ) : null}
        {requests.isLoading ? (
          <Spinner />
        ) : requests.error ? (
          <ErrorNote error={requests.error} />
        ) : requests.data?.items.length === 0 ? (
          <EmptyState>Nothing here.</EmptyState>
        ) : (
          <Table head={<>{canEdit ? <th className="w-10"><PageCheckbox selection={selection} ids={pendingOnPage} label="Select the pending requests on this page" /></th> : null}<th>Type</th><th>From</th><th>To</th><th>Group</th><th>Status</th><th>Updated</th>{canEdit ? <th /> : null}</>}>
            {requests.data?.items.map((r) => (
              <tr key={r.id}>
                {canEdit ? (
                  <td>
                    {r.status === "pending" ? <input type="checkbox" checked={selection.has(r.id)} onChange={() => selection.toggle(r.id)} aria-label={`Select the request from ${r.sender_name}`} /> : null}
                  </td>
                ) : null}
                <td>{r.type === "invitation" ? <Badge tone="blue">Invitation</Badge> : <Badge>Join request</Badge>}</td>
                <td><Link className="hover:underline" to={`/students/${r.sender_id}`}>{r.sender_name}</Link></td>
                <td><Link className="hover:underline" to={`/students/${r.receiver_id}`}>{r.receiver_name}</Link></td>
                <td>{r.group_id ? <Link className="hover:underline" to={`/groups/${r.group_id}`}>{r.group_name}</Link> : r.group_name}</td>
                <td><Badge tone={STATUS_TONE[r.status] ?? "gray"}>{r.status}</Badge></td>
                <td className="whitespace-nowrap text-slate-500">{timeAgo(r.updated_at)}</td>
                {canEdit ? (
                  <td className="text-right">
                    {r.status === "pending" ? (
                      <Button size="sm" variant="ghost" busy={cancel.isPending && cancel.variables === r.id} onClick={() => cancel.mutate(r.id)}>
                        Cancel
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </Table>
        )}
        {requests.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={requests.data.total} onPage={setPage} /> : null}
      </Card>
      <ConfirmDialog
        open={cancelling}
        title={`Cancel ${selection.size} request(s)?`}
        message="The students no longer see them as pending; nobody joins a group."
        confirmLabel="Cancel requests"
        danger
        busy={cancelSelected.isPending}
        onConfirm={() => cancelSelected.mutate()}
        onClose={() => setCancelling(false)}
      />
    </>
  );
}
