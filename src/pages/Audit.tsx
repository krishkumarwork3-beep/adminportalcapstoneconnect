import { Fragment, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api, type AuditRow, type Page } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, PageHeader, Pagination, Select, Spinner, Table, useDebounced } from "../components/ui";

const PAGE_SIZE = 50;

function targetLink(row: AuditRow) {
  if (!row.target_id) return null;
  if (row.target_type === "user") return `/students/${row.target_id}`;
  if (row.target_type === "group") return `/groups/${row.target_id}`;
  return null;
}

export function AuditPage() {
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const query = { q, action, page, page_size: PAGE_SIZE };
  const log = useQuery({ queryKey: ["audit", query], queryFn: () => api<Page<AuditRow>>("/audit", { query }), placeholderData: keepPreviousData });

  return (
    <>
      <PageHeader title="Audit log" description="Every change made in the admin portal: who did what, to which record, and when." />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search the summary or an admin's email" className="pl-8" aria-label="Search the audit log" />
          </div>
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-auto" aria-label="Kind of change">
            <option value="">All changes</option>
            <option value="user.">Students</option>
            <option value="user.ban">Suspensions</option>
            <option value="phone.">Blocked numbers</option>
            <option value="group.">Groups</option>
            <option value="request.">Requests</option>
            <option value="message.">Chat moderation</option>
            <option value="admin.">Admin accounts</option>
            <option value="security.">Security alerts (suspicious reading)</option>
            <option value="data.">Data access (exports, chat reads)</option>
          </Select>
        </div>
        {log.isLoading ? (
          <Spinner />
        ) : log.error ? (
          <ErrorNote error={log.error} />
        ) : log.data?.items.length === 0 ? (
          <EmptyState>No changes recorded yet.</EmptyState>
        ) : (
          <Table head={<><th>When</th><th>Admin</th><th>Change</th><th>Action</th><th /></>}>
            {log.data?.items.map((row) => {
              const link = targetLink(row);
              return (
                <Fragment key={row.id}>
                  <tr>
                    <td className="whitespace-nowrap text-slate-500">{formatDateTime(row.created_at)}</td>
                    <td className="whitespace-nowrap">{row.admin_email}</td>
                    <td>{link ? <Link className="hover:underline" to={link}>{row.summary}</Link> : row.summary}</td>
                    <td><Badge>{row.action}</Badge></td>
                    <td className="text-right">
                      {row.detail ? (
                        <Button size="sm" variant="ghost" onClick={() => setOpen(open === row.id ? null : row.id)}>
                          {open === row.id ? "Hide" : "Details"}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                  {open === row.id ? (
                    <tr>
                      <td colSpan={5} className="bg-slate-50">
                        <pre className="overflow-x-auto text-xs text-slate-700">{JSON.stringify(row.detail, null, 2)}</pre>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </Table>
        )}
        {log.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={log.data.total} onPage={setPage} /> : null}
      </Card>
    </>
  );
}
