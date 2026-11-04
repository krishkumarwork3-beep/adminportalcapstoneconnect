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
| Student | Edit their details, including their phone number (their login). Set a new password (signs them out everywhere). Suspend, optionally also blocking their number. Lift a suspension. Delete (a Group Lead's group passes to the longest-serving member). Remove their photo or résumé (the file is deleted from the server). Their group and activity |
| Groups | Every team with its lead and seats; members of a group; edit a group's name, domain, description and skills; make another member the Group Lead; remove a member; delete a group (members become free, its chat and pending requests go with it) |
| Requests | Join requests and invitations by status and type; cancel a pending one |
| Reports | What students reported (a student, a group or a message), by whom and why; suspend the student, delete the message, mark reviewed, dismiss or reopen. The dashboard counts open reports |
| Announcements | The banner on the student site: text, optional link, info or warning, when it shows; create, edit, delete |
| Recommendations | Read-only: which member recommended which student, for which group, and what happened to it |
| Chats | Read any group or direct conversation; delete a message (the conversation preview updates) |
| Blocked numbers | Block one or many numbers at once, in any format, with a reason; see which have accounts; unblock |
| Audit log | Every change made in the portal: who, what, which record, when, with details; search and filter |
| Select all | Students, Groups, Blocked numbers, Requests and Chats have **Select all N** (every match of the current search and filters, across pages) and act on the selection: delete, suspend, unblock, cancel |
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

- `VITE_API_BASE_URL=https://api.example.com/api npm run build` produces a static site in `dist/`;
  any static host works. Send every path to `index.html` (a single-page app; `vercel.json` does it
  on Vercel).
- The build writes a Content Security Policy for that API into `index.html`, and `dist/_headers`
  (Netlify, Cloudflare Pages) / `vercel.json` add frame protection.
- Serve it on the same site as the API (e.g. `admin.example.com` with `api.example.com`) and add
  its origin to the API's `CORS_ORIGINS`; use HTTPS and `COOKIE_SECURE=true`.
- Keep the portal private (an IP allow-list or the host's password protection); it is `noindex`.
- `npm run lint` (ESLint) and `npm run build` run in CI (`.github/workflows/ci.yml`).
- The whole stack: `../capstoneconnectbackend/DEPLOY.md`.
