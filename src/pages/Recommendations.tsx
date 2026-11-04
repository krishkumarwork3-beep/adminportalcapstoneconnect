import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type Page, type RecommendationRow } from "../lib/api";
import { timeAgo } from "../lib/format";
import { Badge, Card, EmptyState, ErrorNote, PageHeader, Pagination, Select, Spinner, Table } from "../components/ui";

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, "amber" | "green" | "gray" | "blue"> = { pending: "amber", invited: "green", dismissed: "gray", closed: "gray" };

/** Read-only: members vouching for Looking students. Only the Group Lead acts on them, in the app. */
export function RecommendationsPage() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const query = { status, page, page_size: PAGE_SIZE };
  const list = useQuery({ queryKey: ["recommendations", query], queryFn: () => api<Page<RecommendationRow>>("/recommendations", { query }), placeholderData: keepPreviousData });

  return (
    <>
      <PageHeader title="Recommendations" description="Group members vouching for students who are looking for a team. Only the Group Lead acts on them, in the app." />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Status">
            <option value="all">Any status</option>
            <option value="pending">Pending</option>
            <option value="invited">Invited</option>
            <option value="dismissed">Dismissed</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
        {list.isLoading ? (
          <Spinner />
        ) : list.error ? (
          <ErrorNote error={list.error} />
        ) : list.data?.items.length === 0 ? (
          <EmptyState>No recommendations.</EmptyState>
        ) : (
          <Table head={<><th>Student</th><th>Recommended by</th><th>For group</th><th>Note</th><th>Status</th><th>Updated</th></>}>
            {list.data?.items.map((r) => (
              <tr key={r.id}>
                <td><Link className="font-medium hover:underline" to={`/students/${r.student_id}`}>{r.student_name}</Link></td>
                <td><Link className="hover:underline" to={`/students/${r.recommender_id}`}>{r.recommender_name}</Link></td>
                <td>{r.group_id ? <Link className="hover:underline" to={`/groups/${r.group_id}`}>{r.group_name}</Link> : <span className="text-slate-400">deleted group</span>}</td>
                <td className="max-w-72 truncate text-slate-600" title={r.note ?? undefined}>{r.note ?? "—"}</td>
                <td><Badge tone={STATUS_TONE[r.status] ?? "gray"}>{r.status}</Badge></td>
                <td className="whitespace-nowrap text-slate-500">{timeAgo(r.updated_at)}</td>
              </tr>
            ))}
          </Table>
        )}
        {list.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} /> : null}
      </Card>
    </>
  );
}
