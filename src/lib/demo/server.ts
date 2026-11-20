/**
 * Demo mode (VITE_DEMO_MODE=true): answers the admin API in the browser instead of calling a
 * backend. Sample data is the backend's seed (seed.json, the same students as the site's demo)
 * plus a few reports, announcements, blocked numbers and audit entries made up here. Changes
 * are kept in this browser (localStorage) so the portal behaves like the real one.
 */
import seed from "./seed.json";
import type {
  Admin,
  AnnouncementRow,
  AuditRow,
  BlockedNumber,
  ConversationRow,
  GroupDetail,
  GroupRow,
  MessageRow,
  Page,
  RecommendationRow,
  ReportRow,
  RequestRow,
  Stats,
  Student,
  StudentDetail,
} from "../api";

/** The demo admin the log-in page offers. Not a secret: the demo has no backend. */
export const DEMO_ADMIN = { email: "demo@capstoneconnect.app", password: "demo-admin-2026" };

const STORAGE_KEY = "capconnect-admin-demo-v1";

/** An API-style failure from the demo; `userMessage` is written for the person using the portal. */
export class DemoError extends Error {
  constructor(readonly userMessage: string, readonly status: number) {
    super(userMessage);
  }
}

type Seed = typeof seed;
type SeedUser = Seed["users"][number];

interface StudentRec {
  id: string;
  name: string;
  phone: string;
  college: string;
  department: string | null;
  passing_year: number;
  bio: string;
  skills: string[];
  github_url: string | null;
  github_verified: boolean;
  github_contribution_count: number | null;
  avatar_url: string | null;
  resume_url: string | null;
  banned: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  last_seen: string | null;
  created_at: string;
}

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
}

interface GroupRec {
  id: string;
  name: string;
  domain: string;
  description: string;
  max_members: number;
  requirements: string[];
  created_at: string;
  members: Member[];
}

interface ConversationRec {
  id: string;
  type: "group" | "direct";
  title: string;
  participant_ids: string[];
}

interface State {
  students: StudentRec[];
  groups: GroupRec[];
  requests: RequestRow[];
  recommendations: RecommendationRow[];
  conversations: ConversationRec[];
  messages: Record<string, MessageRow[]>;
  reports: ReportRow[];
  announcements: AnnouncementRow[];
  admins: (Admin & { password: string })[];
  blocked: BlockedNumber[];
  audit: AuditRow[];
  /** The signed-in admin's id, or null. */
  session: string | null;
}

// ---------------------------------------------------------------------------------------------
// The sample data
// ---------------------------------------------------------------------------------------------

const now = () => new Date().toISOString();
const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3_600_000).toISOString();
let counter = 0;
const newId = (prefix: string) => `${prefix}_demo${Date.now().toString(36)}${(counter++).toString(36)}`;

function initialState(): State {
  const students: StudentRec[] = seed.users.map((u: SeedUser, i) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    college: u.college,
    department: u.department ?? null,
    passing_year: u.passing_year,
    bio: u.bio ?? "",
    skills: u.skills ?? [],
    github_url: u.github_url ?? null,
    github_verified: Boolean(u.github_verified),
    github_contribution_count: u.github_contribution_count ?? null,
    avatar_url: null,
    resume_url: null,
    banned: false,
    ban_reason: null,
    banned_at: null,
    // Spread over the last days, so "Recently active" and "active today" have something to show.
    last_seen: ago(i % 6, i * 2),
    // Joined over the last two weeks, so the sign-ups chart isn't empty.
    created_at: ago(13 - (i % 14), i),
  }));

  const groups: GroupRec[] = seed.groups.map((g) => ({
    id: g.id,
    name: g.name,
    domain: g.domain,
    description: g.description,
    max_members: g.max_members,
    requirements: g.requirements ?? [],
    created_at: g.created_at,
    members: g.members.map((m) => ({ user_id: m.user_id, role: m.role, joined_at: m.joined_at })),
  }));

  const requests: RequestRow[] = seed.requests.map((r) => ({
    id: r.id,
    type: r.type as RequestRow["type"],
    status: r.status,
    group_id: r.group_id ?? null,
    group_name: r.group_name ?? "",
    sender_id: r.sender_id,
    sender_name: r.sender_name,
    receiver_id: r.receiver_id,
    receiver_name: r.receiver_name,
    note: r.note ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  const groupName = (id: string | null) => seed.groups.find((g) => g.id === id)?.name ?? null;
  const recommendations: RecommendationRow[] = seed.recommendations.map((r) => ({
    id: r.id,
    group_id: r.group_id ?? null,
    group_name: groupName(r.group_id ?? null),
    recommender_id: r.recommender_id,
    recommender_name: r.recommender_name,
    student_id: r.student_id,
    student_name: r.student_name,
    note: r.note ?? null,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  const conversations: ConversationRec[] = seed.conversations.map((c) => ({
    id: c.id,
    type: c.type as ConversationRec["type"],
    title: c.title,
    participant_ids: c.participant_ids,
  }));
  const messages: Record<string, MessageRow[]> = {};
  for (const [convId, list] of Object.entries(seed.messages as Record<string, { id: string; sender_id: string; sender_name: string; text: string; created_at: string }[]>)) {
    messages[convId] = list.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender_name,
      text: m.text,
      attachment_name: null,
      attachment_url: null,
      created_at: m.created_at,
    }));
  }

  const name = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown";
  const report = (
    id: string,
    reporter: string,
    target_type: ReportRow["target_type"],
    target_id: string,
    target_user: string | null,
    reason: string,
    reason_label: string,
    details: string,
    snapshot: string,
    status: ReportRow["status"],
    days: number,
    conversation_id: string | null = null,
  ): ReportRow => ({
    id,
    reporter_id: reporter,
    reporter_name: name(reporter),
    target_type,
    target_id,
    target_user_id: target_user,
    target_user_name: target_user ? name(target_user) : null,
    target_user_banned: false,
    target_exists: true,
    conversation_id,
    reason,
    reason_label,
    details,
    snapshot,
    status,
    handled_by: status === "open" ? null : DEMO_ADMIN.email,
    handled_at: status === "open" ? null : ago(days - 1),
    created_at: ago(days),
  });
  const reports: ReportRow[] = [
    report("rpt_1", "usr_7", "user", "usr_14", "usr_14", "spam", "Spam or advertising", "Keeps messaging everyone about a paid course.", "Bio: DM me for 50% off a placement prep course!", "open", 1),
    report("rpt_2", "usr_3", "message", "msg_201", "usr_8", "harassment", "Harassment", "Rude reply after I declined their request.", "\"You'll regret not taking me on your team.\"", "open", 2, "conv_2"),
    report("rpt_3", "usr_10", "group", "grp_4", null, "misleading", "Misleading information", "The group says it has seats but the lead declines everyone.", "Group: open seats 2 of 4", "reviewed", 5),
    report("rpt_4", "usr_15", "user", "usr_17", "usr_17", "fake", "Fake profile", "GitHub link points to someone else's account.", "GitHub: github.com/torvalds", "dismissed", 8),
  ];

  const announcements: AnnouncementRow[] = [
    {
      id: "ann_1",
      text: "Team formation closes on 15 December: make sure your group is complete before then.",
      link_url: null,
      link_label: null,
      level: "info",
      starts_at: ago(3),
      ends_at: null,
      created_by: DEMO_ADMIN.email,
      created_at: ago(3),
      updated_at: ago(3),
      active: true,
    },
    {
      id: "ann_2",
      text: "Scheduled maintenance on Sunday 2–3 AM: chat may be unavailable.",
      link_url: null,
      link_label: null,
      level: "warning",
      starts_at: ago(10),
      ends_at: ago(9),
      created_by: DEMO_ADMIN.email,
      created_at: ago(10),
      updated_at: ago(9),
      active: false,
    },
  ];

  const admins: State["admins"] = [
    { id: "adm_demo", email: DEMO_ADMIN.email, name: "Demo admin", role: "admin", active: true, last_login_at: null, created_at: ago(30), password: DEMO_ADMIN.password },
    { id: "adm_viewer", email: "viewer@capstoneconnect.app", name: "Read-only reviewer", role: "viewer", active: true, last_login_at: ago(4), created_at: ago(20), password: "viewer-demo-2026" },
  ];

  const blocked: BlockedNumber[] = [
    { phone_normalized: "+919000000001", phone: "+91 90000 00001", reason: "Repeated spam sign-ups", created_by: DEMO_ADMIN.email, created_at: ago(6), account_id: null, account_name: null },
  ];

  const entry = (action: string, target_type: string | null, target_id: string | null, summary: string, days: number): AuditRow => ({
    id: newId("aud"),
    admin_email: DEMO_ADMIN.email,
    action,
    target_type,
    target_id,
    summary,
    detail: null,
    created_at: ago(days),
  });
  const audit: AuditRow[] = [
    entry("report.review", "report", "rpt_3", "Marked report rpt_3 as reviewed", 4),
    entry("phone.block", "phone", "+919000000001", "Blocked +91 90000 00001: Repeated spam sign-ups", 6),
    entry("announcement.create", "announcement", "ann_1", "Posted an announcement", 3),
    entry("admin.create", "admin", "adm_viewer", "Added read-only admin viewer@capstoneconnect.app", 20),
  ];

  return { students, groups, requests, recommendations, conversations, messages, reports, announcements, admins, blocked, audit, session: null };
}

// ---------------------------------------------------------------------------------------------
// State in this browser
// ---------------------------------------------------------------------------------------------

let state: State | null = null;

function load(): State {
  if (state) return state;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = JSON.parse(saved) as State;
  } catch {
    state = null;
  }
  state ??= initialState();
  return state;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: the demo still works for this page load.
  }
}

/** Puts the sample data back (and signs out). */
export function resetDemo() {
  state = initialState();
  save();
}

// ---------------------------------------------------------------------------------------------
// Shaping records like the real API
// ---------------------------------------------------------------------------------------------

function membership(s: State, userId: string) {
  for (const g of s.groups) {
    const m = g.members.find((x) => x.user_id === userId);
    if (m) return { group: g, member: m };
  }
  return null;
}

function normalize(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function studentRow(s: State, r: StudentRec): Student {
  const m = membership(s, r.id);
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    college: r.college,
    department: r.department,
    passing_year: r.passing_year,
    group_id: m?.group.id ?? null,
    group_name: m?.group.name ?? null,
    group_role: m?.member.role ?? null,
    github_url: r.github_url,
    github_contribution_count: r.github_contribution_count,
    banned: r.banned,
    ban_reason: r.ban_reason,
    banned_at: r.banned_at,
    number_blocked: s.blocked.some((b) => b.phone_normalized === normalize(r.phone)),
    last_seen: r.last_seen,
    created_at: r.created_at,
  };
}

function studentDetail(s: State, r: StudentRec): StudentDetail {
  const sent = Object.values(s.messages).flat().filter((m) => m.sender_id === r.id).length;
  return {
    ...studentRow(s, r),
    bio: r.bio,
    skills: r.skills,
    avatar_url: r.avatar_url,
    resume_url: r.resume_url,
    github_verified: r.github_verified,
    requests_sent: s.requests.filter((q) => q.sender_id === r.id).length,
    requests_received: s.requests.filter((q) => q.receiver_id === r.id).length,
    messages_sent: sent,
    conversations: s.conversations.filter((c) => c.participant_ids.includes(r.id)).length,
  };
}

function groupRow(s: State, g: GroupRec): GroupRow {
  const lead = g.members.find((m) => m.role === "admin");
  return {
    id: g.id,
    name: g.name,
    domain: g.domain,
    description: g.description,
    max_members: g.max_members,
    member_count: g.members.length,
    lead_id: lead?.user_id ?? null,
    lead_name: lead ? student(s, lead.user_id).name : null,
    requirements: g.requirements,
    created_at: g.created_at,
  };
}

function groupDetail(s: State, g: GroupRec): GroupDetail {
  return {
    ...groupRow(s, g),
    members: g.members.map((m) => {
      const st = s.students.find((x) => x.id === m.user_id);
      return { user_id: m.user_id, name: st?.name ?? "Deleted student", phone: st?.phone ?? "", role: m.role, joined_at: m.joined_at };
    }),
    pending_requests: s.requests.filter((r) => r.group_id === g.id && r.status === "pending").length,
  };
}

function conversationRow(s: State, c: ConversationRec): ConversationRow {
  const list = s.messages[c.id] ?? [];
  const last = list[list.length - 1];
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    participants: c.participant_ids.map((id) => s.students.find((x) => x.id === id)?.name ?? "Deleted student"),
    message_count: list.length,
    last_message_text: last?.text ?? null,
    last_message_at: last?.created_at ?? null,
  };
}

function student(s: State, id: string): StudentRec {
  const r = s.students.find((x) => x.id === id);
  if (!r) throw new DemoError("Student not found", 404);
  return r;
}

function group(s: State, id: string): GroupRec {
  const g = s.groups.find((x) => x.id === id);
  if (!g) throw new DemoError("Group not found", 404);
  return g;
}

function page<T>(items: T[], query: Query): Page<T> {
  const size = Number(query.page_size) || 25;
  const p = Math.max(1, Number(query.page) || 1);
  return { items: items.slice((p - 1) * size, p * size), total: items.length, page: p, page_size: size };
}

function matches(text: (string | null | undefined)[], q: unknown) {
  const needle = String(q ?? "").trim().toLowerCase();
  return !needle || text.some((t) => (t ?? "").toLowerCase().includes(needle));
}

const newest = <T extends { created_at: string }>(list: T[]) => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));

function me(s: State) {
  const admin = s.admins.find((a) => a.id === s.session && a.active);
  if (!admin) throw new DemoError("Sign in to the admin portal", 401);
  return admin;
}

function publicAdmin(a: State["admins"][number]): Admin {
  const { password: _password, ...rest } = a;
  void _password;
  return rest;
}

function log(s: State, action: string, target_type: string | null, target_id: string | null, summary: string) {
  s.audit.unshift({ id: newId("aud"), admin_email: me(s).email, action, target_type, target_id, summary, detail: null, created_at: now() });
}

function requireEditor(s: State) {
  if (me(s).role !== "admin") throw new DemoError("Read-only admins can't change data", 403);
}

function filterStudents(s: State, query: Query) {
  let list = s.students.filter((r) => matches([r.name, r.phone, r.college, r.department], query.q));
  if (query.college) list = list.filter((r) => r.college === query.college);
  const status = String(query.status ?? "all");
  if (status === "banned") list = list.filter((r) => r.banned);
  if (status === "active") list = list.filter((r) => !r.banned);
  if (status === "in_group") list = list.filter((r) => membership(s, r.id));
  if (status === "looking") list = list.filter((r) => !membership(s, r.id));
  const sort = String(query.sort ?? "newest");
  if (sort === "oldest") list = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
  else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "last_seen") list = [...list].sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""));
  else list = newest(list);
  return list;
}

function filterGroups(s: State, query: Query) {
  let list = s.groups.filter((g) => matches([g.name, g.domain, g.description], query.q));
  if (query.status === "open") list = list.filter((g) => g.members.length < g.max_members);
  if (query.status === "full") list = list.filter((g) => g.members.length >= g.max_members);
  return newest(list);
}

function deleteStudent(s: State, id: string) {
  s.students = s.students.filter((r) => r.id !== id);
  for (const g of s.groups) g.members = g.members.filter((m) => m.user_id !== id);
  s.requests = s.requests.filter((r) => r.sender_id !== id && r.receiver_id !== id);
}

function ban(s: State, id: string, reason: string | null, blockNumber: boolean) {
  const r = student(s, id);
  r.banned = true;
  r.ban_reason = reason || null;
  r.banned_at = now();
  if (blockNumber && !s.blocked.some((b) => b.phone_normalized === normalize(r.phone))) {
    s.blocked.unshift({ phone_normalized: normalize(r.phone), phone: r.phone, reason: reason || "Suspended account", created_by: me(s).email, created_at: now(), account_id: r.id, account_name: r.name });
  }
  log(s, "user.ban", "user", id, `Suspended ${r.name}${reason ? `: ${reason}` : ""}`);
}

function stats(s: State): Stats {
  const inGroup = s.students.filter((r) => membership(s, r.id)).length;
  const weekAgo = ago(7);
  const dayAgo = ago(1);
  const today = new Date().toISOString().slice(0, 10);
  const days = [...Array(14)].map((_, i) => ago(13 - i).slice(0, 10));
  const allMessages = Object.values(s.messages).flat();
  return {
    users: {
      total: s.students.length,
      in_group: inGroup,
      looking: s.students.length - inGroup,
      banned: s.students.filter((r) => r.banned).length,
      new_this_week: s.students.filter((r) => r.created_at >= weekAgo).length,
      active_today: s.students.filter((r) => (r.last_seen ?? "") >= dayAgo).length,
    },
    groups: {
      total: s.groups.length,
      full: s.groups.filter((g) => g.members.length >= g.max_members).length,
      open: s.groups.filter((g) => g.members.length < g.max_members).length,
    },
    requests: {
      pending: s.requests.filter((r) => r.status === "pending").length,
      accepted: s.requests.filter((r) => r.status === "accepted").length,
      declined: s.requests.filter((r) => r.status === "declined").length,
    },
    chat: { conversations: s.conversations.length, messages: allMessages.length, messages_today: allMessages.filter((m) => m.created_at.startsWith(today)).length },
    blocked_numbers: s.blocked.length,
    reports: { open: s.reports.filter((r) => r.status === "open").length },
    signups: days.map((date) => ({ date, count: s.students.filter((r) => r.created_at.startsWith(date)).length })),
    recent_users: newest(s.students).slice(0, 5).map((r) => ({ id: r.id, name: r.name, college: r.college, created_at: r.created_at })),
    recent_actions: s.audit.slice(0, 6),
  };
}

// ---------------------------------------------------------------------------------------------
// The routes (paths are relative to /api/admin, as in api.ts)
// ---------------------------------------------------------------------------------------------

type Query = Record<string, string | number | boolean | null | undefined>;
type Body = Record<string, unknown>;

export async function demoApi(path: string, method: string, query: Query = {}, rawBody?: unknown): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 120)); // feels like a network call
  const s = load();
  const body = (rawBody ?? {}) as Body;
  const parts = path.split("/").filter(Boolean);
  const [res, id, sub, sub2] = parts;
  const result = route(s, res, id, sub, sub2, method, query, body);
  save();
  return result;
}

function route(s: State, res: string, id: string | undefined, sub: string | undefined, sub2: string | undefined, method: string, query: Query, body: Body): unknown {
  // --- Sign-in ---
  if (res === "auth") {
    if (id === "login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const admin = s.admins.find((a) => a.email === email && a.password === body.password && a.active);
      if (!admin) throw new DemoError("Wrong email or password", 401);
      admin.last_login_at = now();
      s.session = admin.id;
      return publicAdmin(admin);
    }
    if (id === "logout" || id === "logout-all") {
      s.session = null;
      return undefined;
    }
    if (id === "me") return publicAdmin(me(s));
    if (id === "password") {
      const admin = me(s);
      if (body.current_password !== admin.password) throw new DemoError("Current password is wrong", 400);
      admin.password = String(body.new_password ?? "");
      return undefined;
    }
    if (id === "refresh") return undefined;
  }

  me(s); // everything else needs a signed-in admin
  const write = method !== "GET";
  if (write) requireEditor(s);

  switch (res) {
    case "stats":
      return stats(s);

    case "users": {
      if (!id && method === "GET") return page(filterStudents(s, query).map((r) => studentRow(s, r)), query);
      if (id === "ids") return filterStudents(s, query).map((r) => r.id);
      if (id === "colleges") return [...new Set(s.students.map((r) => r.college))].sort();
      if (id === "export.csv") {
        const rows = filterStudents(s, { q: body.q as string, status: body.status as string, college: body.college as string });
        const csv = ["name,phone,college,department,passing_year,group", ...rows.map((r) => [r.name, r.phone, r.college, r.department ?? "", r.passing_year, membership(s, r.id)?.group.name ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
        log(s, "data.export", null, null, `Exported ${rows.length} students (demo)`);
        return new Blob([csv], { type: "text/csv" });
      }
      if (id === "bulk") {
        const ids = (body.ids as string[]) ?? [];
        for (const sid of ids) {
          if (body.action === "ban") ban(s, sid, (body.reason as string) ?? null, false);
          else if (body.action === "unban") Object.assign(student(s, sid), { banned: false, ban_reason: null, banned_at: null });
          else deleteStudent(s, sid);
        }
        return { done: ids.length, skipped: [] };
      }
      if (!id && method === "POST") {
        const rec: StudentRec = {
          id: newId("usr"),
          name: String(body.name ?? "").trim() || "New student",
          phone: String(body.phone ?? ""),
          college: String(body.college ?? ""),
          department: (body.department as string) ?? null,
          passing_year: Number(body.passing_year) || new Date().getFullYear(),
          bio: String(body.bio ?? ""),
          skills: (body.skills as string[]) ?? [],
          github_url: (body.github_url as string) ?? null,
          github_verified: false,
          github_contribution_count: null,
          avatar_url: null,
          resume_url: null,
          banned: false,
          ban_reason: null,
          banned_at: null,
          last_seen: null,
          created_at: now(),
        };
        s.students.push(rec);
        log(s, "user.create", "user", rec.id, `Added student ${rec.name}`);
        return studentDetail(s, rec);
      }
      if (id) {
        const r = student(s, id);
        if (!sub && method === "GET") return studentDetail(s, r);
        if (!sub && method === "PATCH") {
          Object.assign(r, {
            name: body.name ?? r.name,
            phone: body.phone ?? r.phone,
            college: body.college ?? r.college,
            department: body.department ?? null,
            passing_year: Number(body.passing_year) || r.passing_year,
            github_url: body.github_url ?? null,
            skills: (body.skills as string[]) ?? r.skills,
            bio: body.bio ?? r.bio,
          });
          log(s, "user.update", "user", id, `Edited ${r.name}`);
          return studentDetail(s, r);
        }
        if (!sub && method === "DELETE") {
          log(s, "user.delete", "user", id, `Deleted ${r.name}`);
          deleteStudent(s, id);
          return undefined;
        }
        if (sub === "ban") {
          ban(s, id, (body.reason as string) ?? null, Boolean(body.block_number));
          return studentDetail(s, r);
        }
        if (sub === "unban") {
          Object.assign(r, { banned: false, ban_reason: null, banned_at: null });
          log(s, "user.unban", "user", id, `Lifted the suspension of ${r.name}`);
          return studentDetail(s, r);
        }
        if (sub === "password") {
          log(s, "user.password", "user", id, `Set a new password for ${r.name}`);
          return undefined;
        }
        if (sub === "avatar" || sub === "resume") {
          r[sub === "avatar" ? "avatar_url" : "resume_url"] = null;
          return studentDetail(s, r);
        }
      }
      break;
    }

    case "banned-phones": {
      if (!id && method === "GET") return s.blocked.filter((b) => matches([b.phone, b.reason, b.account_name], query.q));
      if (!id && method === "POST") {
        const added: string[] = [];
        const already: string[] = [];
        const invalid: string[] = [];
        for (const phone of (body.phones as string[]) ?? []) {
          if (phone.replace(/\D/g, "").length < 10) invalid.push(phone);
          else if (s.blocked.some((b) => b.phone_normalized === normalize(phone))) already.push(phone);
          else {
            const owner = s.students.find((r) => normalize(r.phone) === normalize(phone));
            s.blocked.unshift({ phone_normalized: normalize(phone), phone, reason: (body.reason as string) || null, created_by: me(s).email, created_at: now(), account_id: owner?.id ?? null, account_name: owner?.name ?? null });
            added.push(phone);
          }
        }
        if (added.length) log(s, "phone.block", "phone", null, `Blocked ${added.length} number(s)`);
        return { added, already, invalid };
      }
      if (id === "bulk-delete") {
        const ids = (body.ids as string[]) ?? [];
        s.blocked = s.blocked.filter((b) => !ids.includes(b.phone_normalized));
        return { done: ids.length };
      }
      if (id && method === "DELETE") {
        const phone = decodeURIComponent(id);
        s.blocked = s.blocked.filter((b) => b.phone_normalized !== phone);
        log(s, "phone.unblock", "phone", phone, `Unblocked ${phone}`);
        return undefined;
      }
      break;
    }

    case "groups": {
      if (!id && method === "GET") return page(filterGroups(s, query).map((g) => groupRow(s, g)), query);
      if (id === "ids") return filterGroups(s, query).map((g) => g.id);
      if (id === "bulk-delete") {
        const ids = (body.ids as string[]) ?? [];
        s.groups = s.groups.filter((g) => !ids.includes(g.id));
        log(s, "group.delete", "group", null, `Deleted ${ids.length} group(s)`);
        return { done: ids.length };
      }
      if (id) {
        const g = group(s, id);
        if (!sub && method === "GET") return groupDetail(s, g);
        if (!sub && method === "PATCH") {
          Object.assign(g, {
            name: body.name ?? g.name,
            domain: body.domain ?? g.domain,
            description: body.description ?? g.description,
            max_members: Number(body.max_members) || g.max_members,
            requirements: (body.requirements as string[]) ?? g.requirements,
          });
          log(s, "group.update", "group", id, `Edited group ${g.name}`);
          return groupDetail(s, g);
        }
        if (!sub && method === "DELETE") {
          s.groups = s.groups.filter((x) => x.id !== id);
          log(s, "group.delete", "group", id, `Deleted group ${g.name}`);
          return undefined;
        }
        if (sub === "lead") {
          for (const m of g.members) m.role = m.user_id === body.user_id ? "admin" : "member";
          log(s, "group.lead", "group", id, `Made ${student(s, String(body.user_id)).name} lead of ${g.name}`);
          return groupDetail(s, g);
        }
        if (sub === "members" && sub2) {
          g.members = g.members.filter((m) => m.user_id !== sub2);
          log(s, "group.remove_member", "group", id, `Removed a member from ${g.name}`);
          return undefined;
        }
      }
      break;
    }

    case "reports": {
      if (!id) {
        let list = s.reports;
        if (query.status && query.status !== "all") list = list.filter((r) => r.status === query.status);
        if (query.target_type && query.target_type !== "all") list = list.filter((r) => r.target_type === query.target_type);
        return page(
          newest(list).map((r) => ({ ...r, target_user_banned: Boolean(r.target_user_id && s.students.find((x) => x.id === r.target_user_id)?.banned) })),
          query,
        );
      }
      const r = s.reports.find((x) => x.id === id);
      if (!r) throw new DemoError("Report not found", 404);
      const handle = (status: ReportRow["status"]) => Object.assign(r, { status, handled_by: me(s).email, handled_at: now() });
      if (sub === "status") {
        handle(body.status as ReportRow["status"]);
        log(s, "report.status", "report", id, `Marked report ${id} as ${String(body.status)}`);
      }
      if (sub === "suspend" && r.target_user_id) {
        ban(s, r.target_user_id, (body.reason as string) ?? r.reason_label, false);
        handle("actioned");
      }
      if (sub === "delete-message") {
        for (const list of Object.values(s.messages)) {
          const i = list.findIndex((m) => m.id === r.target_id);
          if (i >= 0) list.splice(i, 1);
        }
        r.target_exists = false;
        handle("actioned");
        log(s, "message.delete", "message", r.target_id, "Deleted a reported message");
      }
      return { ...r };
    }

    case "requests": {
      const filtered = (statusFilter: unknown, type: unknown) =>
        newest(s.requests.filter((r) => (!statusFilter || statusFilter === "all" || r.status === statusFilter) && (!type || type === "all" || r.type === type)));
      if (!id) return page(filtered(query.status, query.type), query);
      if (id === "ids") return filtered("pending", query.type).map((r) => r.id);
      const cancel = (rid: string) => {
        const r = s.requests.find((x) => x.id === rid);
        if (r && r.status === "pending") Object.assign(r, { status: "cancelled", updated_at: now() });
        return Boolean(r);
      };
      if (id === "bulk-cancel") {
        const ids = (body.ids as string[]) ?? [];
        ids.forEach(cancel);
        log(s, "request.cancel", "request", null, `Cancelled ${ids.length} request(s)`);
        return { done: ids.length, skipped: [] };
      }
      if (sub === "cancel") {
        cancel(id);
        log(s, "request.cancel", "request", id, `Cancelled request ${id}`);
        return undefined;
      }
      break;
    }

    case "recommendations": {
      const list = s.recommendations.filter((r) => !query.status || query.status === "all" || r.status === query.status);
      return page(newest(list), query);
    }

    case "conversations": {
      if (!id) {
        const rows = s.conversations
          .map((c) => conversationRow(s, c))
          .filter((c) => matches([c.title, ...c.participants], query.q))
          .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
        return page(rows, query);
      }
      if (sub === "messages") {
        log(s, "data.chat_read", "conversation", id, `Read a chat${query.reason ? `: ${String(query.reason)}` : ""}`);
        return [...(s.messages[id] ?? [])];
      }
      break;
    }

    case "messages": {
      const remove = (ids: string[]) => {
        for (const list of Object.values(s.messages)) {
          for (let i = list.length - 1; i >= 0; i--) if (ids.includes(list[i].id)) list.splice(i, 1);
        }
      };
      if (id === "bulk-delete") {
        const ids = (body.ids as string[]) ?? [];
        remove(ids);
        log(s, "message.delete", "message", null, `Deleted ${ids.length} message(s)`);
        return { done: ids.length };
      }
      if (id && method === "DELETE") {
        remove([id]);
        log(s, "message.delete", "message", id, "Deleted a message");
        return undefined;
      }
      break;
    }

    case "announcements": {
      if (!id && method === "GET") return newest(s.announcements);
      if (!id && method === "POST") {
        const row: AnnouncementRow = {
          id: newId("ann"),
          text: String(body.text ?? ""),
          link_url: (body.link_url as string) || null,
          link_label: (body.link_label as string) || null,
          level: body.level === "warning" ? "warning" : "info",
          starts_at: (body.starts_at as string) || now(),
          ends_at: (body.ends_at as string) || null,
          created_by: me(s).email,
          created_at: now(),
          updated_at: now(),
          active: true,
        };
        s.announcements.unshift(row);
        log(s, "announcement.create", "announcement", row.id, "Posted an announcement");
        return row;
      }
      const a = s.announcements.find((x) => x.id === id);
      if (!a) throw new DemoError("Announcement not found", 404);
      if (method === "PATCH") {
        Object.assign(a, body, { updated_at: now() });
        return a;
      }
      if (method === "DELETE") {
        s.announcements = s.announcements.filter((x) => x.id !== id);
        return undefined;
      }
      break;
    }

    case "admins": {
      if (!id && method === "GET") return s.admins.map(publicAdmin);
      if (!id && method === "POST") {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (s.admins.some((a) => a.email === email)) throw new DemoError("An admin with this email already exists", 409);
        const admin = { id: newId("adm"), email, name: String(body.name ?? email), role: (body.role === "viewer" ? "viewer" : "admin") as Admin["role"], active: true, last_login_at: null, created_at: now(), password: String(body.password ?? "") };
        s.admins.push(admin);
        log(s, "admin.create", "admin", admin.id, `Added admin ${email}`);
        return publicAdmin(admin);
      }
      const a = s.admins.find((x) => x.id === id);
      if (!a) throw new DemoError("Admin not found", 404);
      if (a.id === s.session && method !== "GET") throw new DemoError("You can't change your own account here", 400);
      if (method === "PATCH") {
        Object.assign(a, { role: body.role ?? a.role, active: body.active ?? a.active });
        return publicAdmin(a);
      }
      if (method === "DELETE") {
        s.admins = s.admins.filter((x) => x.id !== id);
        return undefined;
      }
      break;
    }

    case "audit": {
      const list = s.audit.filter((e) => matches([e.summary, e.admin_email, e.target_id], query.q) && (!query.action || e.action.startsWith(String(query.action))));
      return page(list, query);
    }
  }
  throw new DemoError(write ? "That isn't available in the demo" : "Not found", 404);
}
