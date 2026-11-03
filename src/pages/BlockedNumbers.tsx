import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api, type BlockedNumber } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTime } from "../lib/format";
import { Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, PageHeader, Spinner, Table, Textarea, useDebounced, useToast } from "../components/ui";

export function BlockedNumbersPage() {
  const { canEdit } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [numbers, setNumbers] = useState("");
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState<BlockedNumber | null>(null);
  const list = useQuery({ queryKey: ["blocked", q], queryFn: () => api<BlockedNumber[]>("/banned-phones", { query: { q } }) });

  const add = useMutation({
    mutationFn: () =>
      api<{ added: string[]; already: string[]; invalid: string[] }>("/banned-phones", {
        method: "POST",
        body: { phones: numbers.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean), reason },
      }),
    onSuccess: (r) => {
      const parts = [`Blocked ${r.added.length}`];
      if (r.already.length) parts.push(`${r.already.length} already blocked`);
      if (r.invalid.length) parts.push(`not numbers: ${r.invalid.join(", ")}`);
      toast(parts.join(" · "), r.invalid.length ? "error" : "ok");
      setNumbers("");
      setReason("");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });
  const remove = useMutation({
    mutationFn: (phone: string) => api(`/banned-phones/${phone}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Number unblocked");
      setRemoving(null);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate();
  };

  return (
    <>
      <PageHeader title="Blocked numbers" description="A blocked number can't sign up, sign in or reset a password. An account on a blocked number counts as suspended." />
      <div className="grid gap-4 lg:grid-cols-3">
        {canEdit ? (
          <Card title="Block numbers">
            <form onSubmit={submit} className="space-y-4 p-4">
              <Field label="Phone numbers" hint="One per line (or separated by commas), any format: +91 98765 43210, 9876543210…">
                {(id) => <Textarea id={id} required rows={5} value={numbers} onChange={(e) => setNumbers(e.target.value)} />}
              </Field>
              <Field label="Reason (optional)">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. spam accounts" />}</Field>
              <Button type="submit" variant="primary" busy={add.isPending} disabled={!numbers.trim()} className="w-full">
                Block
              </Button>
            </form>
          </Card>
        ) : null}
        <Card className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a number" className="pl-8" aria-label="Find a number" />
            </div>
          </div>
          {list.isLoading ? (
            <Spinner />
          ) : list.error ? (
            <ErrorNote error={list.error} />
          ) : list.data?.length === 0 ? (
            <EmptyState>No blocked numbers.</EmptyState>
          ) : (
            <Table head={<><th>Number</th><th>Account</th><th>Reason</th><th>Blocked</th>{canEdit ? <th /> : null}</>}>
              {list.data?.map((b) => (
                <tr key={b.phone_normalized}>
                  <td className="whitespace-nowrap tabular-nums">+{b.phone_normalized}</td>
                  <td>{b.account_id ? <Link className="hover:underline" to={`/students/${b.account_id}`}>{b.account_name}</Link> : <span className="text-slate-400">no account</span>}</td>
                  <td className="max-w-64 truncate text-slate-600">{b.reason ?? "—"}</td>
                  <td className="whitespace-nowrap text-slate-500">
                    {formatDateTime(b.created_at)}
                    <div className="text-xs">{b.created_by}</div>
                  </td>
                  {canEdit ? (
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(b)}>Unblock</Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={removing !== null}
        title={`Unblock +${removing?.phone_normalized}?`}
        message={removing?.account_name ? `${removing.account_name} can sign in again (unless their account is also suspended).` : "The number can be used to sign up again."}
        confirmLabel="Unblock"
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.phone_normalized)}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
