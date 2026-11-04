import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type Page, type ReportRow } from "../lib/api";
import { useAuth } from "../lib/auth";
import { timeAgo } from "../lib/format";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, PageHeader, Pagination, Select, Spinner, Table, useToast } from "../components/ui";

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, "amber" | "green" | "gray" | "blue" | "red"> = { open: "amber", reviewed: "blue", dismissed: "gray", actioned: "green" };
const TYPE_LABEL: Record<string, string> = { user: "Student", group: "Group", message: "Message" };

type Action = { kind: "suspend" | "delete" | "dismiss" | "reviewed" | "reopen"; report: ReportRow };

function targetLink(r: ReportRow) {
  if (r.target_type === "user") return `/students/${r.target_id}`;
  if (r.target_type === "group") return `/groups/${r.target_id}`;
  return r.conversation_id ? `/chats?c=${r.conversation_id}` : null;
}

/** Reports from students: what was reported, by whom and why; suspend, delete the message or dismiss. */
export function ReportsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("open");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const query = { status, target_type: type, page, page_size: PAGE_SIZE };
  const list = useQuery({ queryKey: ["reports", query], queryFn: () => api<Page<ReportRow>>("/reports", { query }), placeholderData: keepPreviousData });

  const act = useMutation({
    mutationFn: ({ kind, report }: Action) => {
      if (kind === "suspend") return api<ReportRow>(`/reports/${report.id}/suspend`, { method: "POST", body: { reason } });
      if (kind === "delete") return api<ReportRow>(`/reports/${report.id}/delete-message`, { method: "POST" });
      const next = kind === "dismiss" ? "dismissed" : kind === "reopen" ? "open" : "reviewed";
      return api<ReportRow>(`/reports/${report.id}/status`, { method: "POST", body: { status: next } });
    },
    onSuccess: (_, { kind }) => {
      toast({ suspend: "Student suspended", delete: "Message deleted", dismiss: "Report dismissed", reviewed: "Marked reviewed", reopen: "Report reopened" }[kind]);
      setAction(null);
      setReason("");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const confirmText: Record<Action["kind"], { title: string; message: string; label: string; danger: boolean }> = {
    suspend: { title: `Suspend ${action?.report.target_user_name ?? "this student"}?`, message: "They are signed out at once and can't sign in until the suspension is lifted.", label: "Suspend", danger: true },
    delete: { title: "Delete the reported message?", message: "It disappears for everyone in the conversation. The report keeps a copy of what it said.", label: "Delete message", danger: true },
    dismiss: { title: "Dismiss this report?", message: "Nothing happens to the reported student, group or message.", label: "Dismiss", danger: false },
    reviewed: { title: "Mark as reviewed?", message: "For reports you have looked at and want to keep an eye on.", label: "Mark reviewed", danger: false },
    reopen: { title: "Reopen this report?", message: "It goes back to the open reports.", label: "Reopen", danger: false },
  };

  return (
    <>
      <PageHeader title="Reports" description="Students reporting other students, groups and chat messages. Only admins see reports; the reported student is never told who reported them." />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Status">
            <option value="open">Open</option>
            <option value="reviewed">Reviewed</option>
            <option value="actioned">Actioned</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">Any status</option>
          </Select>
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-auto" aria-label="Type">
            <option value="all">Students, groups and messages</option>
            <option value="user">Students</option>
            <option value="group">Groups</option>
            <option value="message">Messages</option>
          </Select>
        </div>
        {list.isLoading ? (
          <Spinner />
        ) : list.error ? (
          <ErrorNote error={list.error} />
        ) : list.data?.items.length === 0 ? (
          <EmptyState>{status === "open" ? "No open reports. Nice." : "Nothing here."}</EmptyState>
        ) : (
          <Table head={<><th>Reported</th><th>Reason</th><th>By</th><th>Status</th><th>When</th>{canEdit ? <th /> : null}</>}>
            {list.data?.items.map((r) => {
              const link = targetLink(r);
              return (
                <tr key={r.id} className="align-top">
                  <td className="max-w-md">
                    <div className="flex items-center gap-2">
                      <Badge>{TYPE_LABEL[r.target_type]}</Badge>
                      {link && r.target_exists ? <Link className="font-medium hover:underline" to={link}>{r.snapshot.split(":")[0].split(" · ")[0]}</Link> : <span className="font-medium">{r.snapshot.split(":")[0].split(" · ")[0]}</span>}
                      {!r.target_exists ? <Badge tone="gray">deleted</Badge> : null}
                      {r.target_user_banned ? <Badge tone="red">suspended</Badge> : null}
                    </div>
                    {r.target_type === "message" ? <p className="mt-1 text-sm break-words whitespace-pre-wrap text-slate-700">“{r.snapshot.split(": ").slice(1).join(": ")}”</p> : null}
                    {r.details ? <p className="mt-1 text-xs text-slate-500">Reporter: {r.details}</p> : null}
                  </td>
                  <td className="whitespace-nowrap">{r.reason_label}</td>
                  <td><Link className="hover:underline" to={`/students/${r.reporter_id}`}>{r.reporter_name}</Link></td>
                  <td>
                    <Badge tone={STATUS_TONE[r.status] ?? "gray"}>{r.status}</Badge>
                    {r.handled_by ? <div className="mt-1 text-xs text-slate-400">{r.handled_by}</div> : null}
                  </td>
                  <td className="whitespace-nowrap text-slate-500">{timeAgo(r.created_at)}</td>
                  {canEdit ? (
                    <td className="text-right whitespace-nowrap">
                      {r.status === "open" || r.status === "reviewed" ? (
                        <>
                          {r.target_user_id && !r.target_user_banned ? <Button size="sm" variant="danger" onClick={() => setAction({ kind: "suspend", report: r })}>Suspend</Button> : null}
                          {r.target_type === "message" && r.target_exists ? <Button size="sm" variant="danger" className="ml-1" onClick={() => setAction({ kind: "delete", report: r })}>Delete message</Button> : null}
                          {r.status === "open" ? <Button size="sm" className="ml-1" onClick={() => setAction({ kind: "reviewed", report: r })}>Reviewed</Button> : null}
                          <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "dismiss", report: r })}>Dismiss</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "reopen", report: r })}>Reopen</Button>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </Table>
        )}
        {list.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} /> : null}
      </Card>
      {action ? (
        <ConfirmDialog
          open
          title={confirmText[action.kind].title}
          message={confirmText[action.kind].message}
          confirmLabel={confirmText[action.kind].label}
          danger={confirmText[action.kind].danger}
          busy={act.isPending}
          onConfirm={() => act.mutate(action)}
          onClose={() => setAction(null)}
        >
          {action.kind === "suspend" ? (
            <Field label="Reason (kept in the audit log)">{(fid) => <Input id={fid} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Report: ${action.report.reason_label}`} />}</Field>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </>
  );
}
