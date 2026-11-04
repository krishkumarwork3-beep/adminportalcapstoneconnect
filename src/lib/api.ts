import { parseJson } from "./security/json";
// Client for the CapstoneConnect admin API (/api/admin). The admin session is an httpOnly cookie,
// so every request is sent with credentials and the portal never sees the token.

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000/api";
/** The API's own origin (http://localhost:8000): its interactive docs live at /docs and /redoc. */
export const API_ORIGIN = new URL(API_BASE_URL).origin;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_BASE_URL}/admin${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(`Can't reach the API at ${API_ORIGIN}. Is the backend running?`, 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.text().then((t) => (t ? parseJson<Record<string, string>>(t) : {})).catch(() => ({} as Record<string, string>));
  if (!response.ok) throw new ApiError(data.message || `Request failed (${response.status})`, response.status);
  return data as T;
}

// ---------------------------------------------------------------------------------------------
// Types (mirroring app/admin_schemas.py)
// ---------------------------------------------------------------------------------------------

export type AdminRole = "admin" | "viewer";

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  college: string;
  department: string | null;
  passing_year: number;
  group_id: string | null;
  group_name: string | null;
  group_role: string | null;
  github_url: string | null;
  github_contribution_count: number | null;
  banned: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  number_blocked: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface StudentDetail extends Student {
  bio: string;
  skills: string[];
  avatar_url: string | null;
  resume_url: string | null;
  github_verified: boolean;
  requests_sent: number;
  requests_received: number;
  messages_sent: number;
  conversations: number;
}

export interface BlockedNumber {
  phone_normalized: string;
  phone: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  account_id: string | null;
  account_name: string | null;
}

export interface GroupRow {
  id: string;
  name: string;
  domain: string;
  description: string;
  max_members: number;
  member_count: number;
  lead_id: string | null;
  lead_name: string | null;
  requirements: string[];
  created_at: string;
}

export interface GroupDetail extends GroupRow {
  members: { user_id: string; name: string; phone: string; role: string; joined_at: string }[];
  pending_requests: number;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_type: "user" | "group" | "message";
  target_id: string;
  target_user_id: string | null;
  target_user_name: string | null;
  target_user_banned: boolean;
  target_exists: boolean;
  conversation_id: string | null;
  reason: string;
  reason_label: string;
  details: string;
  snapshot: string;
  status: "open" | "reviewed" | "dismissed" | "actioned";
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface AnnouncementRow {
  id: string;
  text: string;
  link_url: string | null;
  link_label: string | null;
  level: "info" | "warning";
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface RecommendationRow {
  id: string;
  group_id: string | null;
  group_name: string | null;
  recommender_id: string;
  recommender_name: string;
  student_id: string;
  student_name: string;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RequestRow {
  id: string;
  type: "join_request" | "invitation";
  status: string;
  group_id: string | null;
  group_name: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  receiver_name: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  type: "group" | "direct";
  title: string;
  participants: string[];
  message_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
}

export interface MessageRow {
  id: string;
  sender_id: string | null;
  sender_name: string;
  text: string;
  attachment_name: string | null;
  attachment_url: string | null;
  created_at: string;
}

export interface AuditRow {
  id: string;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface Stats {
  users: { total: number; in_group: number; looking: number; banned: number; new_this_week: number; active_today: number };
  groups: { total: number; full: number; open: number };
  requests: { pending: number; accepted: number; declined: number };
  chat: { conversations: number; messages: number; messages_today: number };
  blocked_numbers: number;
  reports: { open: number };
  signups: { date: string; count: number }[];
  recent_users: { id: string; name: string; college: string; created_at: string }[];
  recent_actions: AuditRow[];
}
