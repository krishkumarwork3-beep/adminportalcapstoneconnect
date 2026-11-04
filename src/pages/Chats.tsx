import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Paperclip, Search, Trash2 } from "lucide-react";
import { api, type ConversationRow, type MessageRow, type Page } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTime, timeAgo } from "../lib/format";
import { safeHref } from "../lib/security/safe-url";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Input, PageHeader, Pagination, SelectionBar, Spinner, cn, useDebounced, useSelection, useToast } from "../components/ui";

const PAGE_SIZE = 20;

export function ChatsPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [params] = useSearchParams();
  // ?c=conv_… opens that conversation (links from the Reports page).
  const [openId, setOpenId] = useState<string | null>(params.get("c"));
  const [deleting, setDeleting] = useState<MessageRow | null>(null);
  const selection = useSelection();
  const [deletingSelected, setDeletingSelected] = useState(false);

  const query = { q, page, page_size: PAGE_SIZE };
  const conversations = useQuery({ queryKey: ["conversations", query], queryFn: () => api<Page<ConversationRow>>("/conversations", { query }), placeholderData: keepPreviousData });
  const open = conversations.data?.items.find((c) => c.id === openId) ?? null;
  const messages = useQuery({ queryKey: ["messages", openId], queryFn: () => api<MessageRow[]>(`/conversations/${openId}/messages`), enabled: Boolean(openId) });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Message deleted");
      setDeleting(null);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const removeSelected = useMutation({
    mutationFn: () => api<{ done: number }>("/messages/bulk-delete", { method: "POST", body: { ids: selection.ids } }),
    onSuccess: (r) => {
      toast(`Deleted ${r.done} message(s)`);
      setDeletingSelected(false);
      selection.clear();
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });
  const shown = messages.data ?? [];

  return (
    <>
      <PageHeader title="Chats" description="Read any conversation and remove messages that break the rules. Deletions are recorded in the audit log." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search a group or a person" className="pl-8" aria-label="Search conversations" />
            </div>
          </div>
          {conversations.isLoading ? (
            <Spinner />
          ) : conversations.error ? (
            <ErrorNote error={conversations.error} />
          ) : conversations.data?.items.length === 0 ? (
            <EmptyState>No conversations.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.data?.items.map((c) => (
                <li key={c.id}>
                  <button onClick={() => { setOpenId(c.id); selection.clear(); }} className={cn("w-full px-4 py-3 text-left hover:bg-slate-50", c.id === openId && "bg-orange-50 hover:bg-orange-50")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{c.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">{timeAgo(c.last_message_at)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <Badge tone={c.type === "group" ? "blue" : "gray"}>{c.type === "group" ? "Group" : "Direct"}</Badge>
                      <span>{c.message_count} messages</span>
                      <span className="truncate">{c.last_message_text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {conversations.data ? <Pagination page={page} pageSize={PAGE_SIZE} total={conversations.data.total} onPage={setPage} /> : null}
        </Card>

        <Card title={open ? open.title : "Messages"} actions={open ? <span className="text-xs text-slate-500">{open.participants.join(", ")}</span> : null}>
          {canEdit && openId ? (
            <SelectionBar selection={selection} total={shown.length} noun="messages" onSelectAll={() => shown.map((m) => m.id)}>
              <Button size="sm" variant="danger" onClick={() => setDeletingSelected(true)}>
                <Trash2 className="h-4 w-4" /> Delete selected
              </Button>
            </SelectionBar>
          ) : null}
          {!openId ? (
            <EmptyState>Pick a conversation to read it.</EmptyState>
          ) : messages.isLoading ? (
            <Spinner />
          ) : messages.error ? (
            <ErrorNote error={messages.error} />
          ) : messages.data?.length === 0 ? (
            <EmptyState>No messages yet.</EmptyState>
          ) : (
            <ul className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">
              {messages.data?.map((m) => (
                <li key={m.id} className={cn("group flex items-start gap-3 px-4 py-3", selection.has(m.id) && "bg-orange-50/60")}>
                  {canEdit ? <input type="checkbox" className="mt-1" checked={selection.has(m.id)} onChange={() => selection.toggle(m.id)} aria-label={`Select the message from ${m.sender_name}`} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">
                      {m.sender_id ? <Link className="font-medium text-slate-800 hover:underline" to={`/students/${m.sender_id}`}>{m.sender_name}</Link> : <span className="font-medium">{m.sender_name}</span>}
                      {" · "}
                      {formatDateTime(m.created_at)}
                    </p>
                    {m.text ? <p className="mt-0.5 text-sm whitespace-pre-wrap break-words text-slate-800">{m.text}</p> : null}
                    {m.attachment_name ? (
                      <a href={safeHref(m.attachment_url)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-orange-700 hover:underline">
                        <Paperclip className="h-3.5 w-3.5" /> {m.attachment_name}
                      </a>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <Button size="sm" variant="ghost" className="opacity-60 group-hover:opacity-100" onClick={() => setDeleting(m)} aria-label="Delete message">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this message?"
        message={<>“{deleting?.text || deleting?.attachment_name}” by {deleting?.sender_name}. It disappears for everyone in the conversation.</>}
        confirmLabel="Delete message"
        danger
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={deletingSelected}
        title={`Delete ${selection.size} message(s)?`}
        message="They disappear for everyone in the conversation. This can't be undone."
        confirmLabel="Delete messages"
        danger
        busy={removeSelected.isPending}
        onConfirm={() => removeSelected.mutate()}
        onClose={() => setDeletingSelected(false)}
      />
    </>
  );
}
