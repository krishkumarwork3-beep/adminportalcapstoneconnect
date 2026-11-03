import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type Stats } from "../lib/api";
import { formatDate, timeAgo } from "../lib/format";
import { Card, ErrorNote, PageHeader, Spinner } from "../components/ui";

function Stat({ label, value, note, to }: { label: string; value: number; note?: string; to?: string }) {
  const body = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value.toLocaleString("en-IN")}</p>
      {note ? <p className="mt-0.5 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** Sign-ups per day: plain bars, the day's count on hover. */
function SignupChart({ data }: { data: Stats["signups"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="p-4">
      <p className="mb-3 text-[13px] text-slate-500">{total.toLocaleString("en-IN")} sign-ups in the last 30 days</p>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`Sign-ups per day, last 30 days: ${total} in total`}>
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-sm bg-orange-400 transition-colors group-hover:bg-orange-500" style={{ height: `${Math.max(d.count ? 6 : 1, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white group-hover:block">
              {formatDate(d.date)}: {d.count}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
        <span>{formatDate(data[0]?.date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/stats"), refetchInterval: 30_000 });
  if (stats.isLoading) return <Spinner />;
  if (stats.error || !stats.data) return <ErrorNote error={stats.error} />;
  const s = stats.data;

  return (
    <>
      <PageHeader title="Dashboard" description="The site at a glance. Refreshes every 30 seconds." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Students" value={s.users.total} note={`${s.users.new_this_week} new this week`} to="/students" />
        <Stat label="Active today" value={s.users.active_today} note={`${s.users.looking} still looking for a team`} />
        <Stat label="Groups" value={s.groups.total} note={`${s.groups.open} open, ${s.groups.full} full`} to="/groups" />
        <Stat label="Pending requests" value={s.requests.pending} note={`${s.requests.accepted} accepted so far`} to="/requests" />
        <Stat label="Messages" value={s.chat.messages} note={`${s.chat.messages_today} in the last 24 h`} to="/chats" />
        <Stat label="Conversations" value={s.chat.conversations} />
        <Stat label="Suspended students" value={s.users.banned} to="/students?status=banned" />
        <Stat label="Blocked numbers" value={s.blocked_numbers} to="/blocked-numbers" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Sign-ups" className="lg:col-span-2">
          <SignupChart data={s.signups} />
        </Card>
        <Card title="Newest students" actions={<Link to="/students" className="text-xs text-orange-700 hover:underline">All students</Link>}>
          <ul className="divide-y divide-slate-100">
            {s.recent_users.map((u) => (
              <li key={u.id}>
                <Link to={`/students/${u.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{u.name}</span>
                    <span className="block truncate text-xs text-slate-500">{u.college}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(u.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Recent admin activity" className="mt-4" actions={<Link to="/audit" className="text-xs text-orange-700 hover:underline">Full audit log</Link>}>
        {s.recent_actions.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No admin changes yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {s.recent_actions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2.5 text-sm">
                <span className="text-slate-800">{a.summary}</span>
                <span className="text-xs text-slate-400">
                  {a.admin_email} · {timeAgo(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
