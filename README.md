# CapstoneConnect admin portal

A web portal for running CapstoneConnect: manage students, groups, requests and chats, suspend
accounts, block phone numbers, see what every admin changed, and test the API.

It talks to the FastAPI backend (`../capstoneconnectbackend`) through its admin API
(`/api/admin`). Built with Vite, React 19, React Router, TanStack Query and Tailwind CSS.

## Run it

1. Start the backend (see its README), with `http://localhost:3100` in its `CORS_ORIGINS`:

   ```bash
   cd ../capstoneconnectbackend
   uv run python scripts/local_postgres.py      # local PostgreSQL, if you use it
   uv run alembic upgrade head
   uv run uvicorn app.main:app --port 8000
   ```

2. Start the portal:

   ```bash
   npm install
   cp .env.example .env.local                   # only if the API is not on localhost:8000
   npm run dev                                  # http://localhost:3100
   ```

3. Sign in with an admin account (below).

Open the portal and the API on the same host (`localhost` with `localhost`): the admin session is
an httpOnly cookie, sent only to the same site.

## Admin accounts

Admins are separate from students: they sign in with an email and password, and have their own
session cookie (`cc_admin`).

- **First admin:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend's `.env`; it is created
  when the API starts (if no admin has that email yet).
- **From the command line** (also to reset a forgotten admin password):

  ```bash
  cd ../capstoneconnectbackend
  uv run python -m app.admin_cli create you@example.com "Your Name"   # asks for a password
  uv run python -m app.admin_cli password you@example.com
  uv run python -m app.admin_cli list
  ```

- **In the portal:** Admins → Add admin.

Two levels of access: **Admin** (can change anything) and **Read-only** (sees every page, no
buttons that change data; the API refuses changes too). Five wrong passwords lock an email out for
two minutes. Changing an admin's password, or deactivating them, signs them out everywhere.

## What it does

| Page | |
| --- | --- |
| Dashboard | Students, activity, groups, requests, messages, suspensions and blocked numbers at a glance; sign-ups per day for 30 days; newest students; latest admin actions |
| Students | Search by name, college, phone (any format) or id; filter by status and college; sort; page through. Add a student. Select several to suspend, lift or delete. Export the list (with the current filters) as CSV |
| Student | Edit their details, including their phone number (their login). Set a new password (signs them out everywhere). Suspend, optionally also blocking their number. Lift a suspension. Delete (a Group Lead's group passes to the longest-serving member). Their group and activity |
| Groups | Every team with its lead and seats; members of a group; remove a member; delete a group (members become free, its chat and pending requests go with it) |
| Requests | Join requests and invitations by status and type; cancel a pending one |
| Chats | Read any group or direct conversation; delete a message (the conversation preview updates) |
| Blocked numbers | Block one or many numbers at once, in any format, with a reason; see which have accounts; unblock |
| Audit log | Every change made in the portal: who, what, which record, when, with details; search and filter |
| Admins | Add admins, change their access, deactivate or remove them; change your own password |
| API & docs | Backend health; Swagger UI (embedded), ReDoc and the OpenAPI file for testing endpoints |

### What a suspension or a blocked number does

- **Suspended account:** signed out at once, and can't sign in, reset the password or use the live
  chat until the suspension is lifted.
- **Blocked number:** can't be used to sign up, sign in or reset a password. An existing account on
  that number counts as suspended for as long as the number stays blocked.

### Testing the API

API & docs embeds FastAPI's Swagger UI. Because the docs are served by the API itself (same host),
your admin session works there too: every admin endpoint can be tried directly. To call student
endpoints, run `POST /api/auth/login` with a student's phone and password first (seeded students use
`password123`). These calls change the real database.

## Production

- Serve the portal on the same site as the API (e.g. `admin.example.com` with `api.example.com`) and
  add its origin to the backend's `CORS_ORIGINS`; use HTTPS and `COOKIE_SECURE=true`.
- `npm run build` produces a static site in `dist/`; any static host works. Send every path to
  `index.html` (it is a single-page app).
- Keep the portal private (an IP allow-list or SSO in front of it is a good idea); it is marked
  `noindex`.
