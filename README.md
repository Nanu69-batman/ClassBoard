# ClassBoard

An assignment dashboard for a college class. Students open their class link and
see what is due; no account needed. A class representative (CR) posts, edits
and archives assignments, with an optional file (PDF, PowerPoint, Word, Excel,
text or image). A superadmin manages classes and CRs.

Backend: **Supabase**. Postgres with row-level security holds the shared data,
Supabase Auth signs in CRs and the superadmin, and Supabase Storage holds the
files. A student's "done" ticks stay in their own browser's `localStorage` and
are never sent anywhere.

## Requirements

- Node.js 20.19+ (or 22.12+)
- A Supabase project (the free plan is enough)

## Setup

1. **Create the schema.** Open Supabase dashboard → SQL Editor, paste
   `supabase/migrations/20261110000000_init.sql` and run it. (Or, with the
   Supabase CLI linked to the project, `npm run db:push`.) This creates the
   tables, the row-level security policies, the invite functions and the
   `attachments` storage bucket.
2. **Point the app at the project.** Put the Project URL and the **anon** key
   (Project Settings → API) in `src/lib/supabase.ts`. Both are public by design
   and safe to commit.
3. **Auth settings** (Authentication → URL Configuration): set the Site URL to
   the deployed domain and add redirect URLs for `http://localhost:5173/**` and
   `https://<your-domain>/**`. Google sign-in and email-confirmation links come
   back through these.
4. **Google sign-in** (optional; Authentication → Providers → Google): add
   a Google OAuth client ID and secret.
5. **Admin scripts.** Copy `.env.example` to `.env.local` and fill in
   `SUPABASE_URL` and the **service_role** key. That key bypasses every security
   rule: it stays in `.env.local` (gitignored) and is never used in `src/`.
6. Seed sample data, or bind a real superadmin:

   ```bash
   npm run seed:dry                                  # preview
   SEED_ALLOW_PRODUCTION=1 npm run seed              # sample classes + accounts
   npm run bind:superadmin -- you@example.com        # after signing in once
   npm run invite -- ece-2026-a                      # CR invite link
   ```

7. `npm install && npm run dev`, then open <http://localhost:5173/class/ece-2026-a>.

## Who can do what

Enforced by row-level security in the migration, not by the frontend.

| | Student (no account) | CR | Superadmin |
| --- | --- | --- | --- |
| Read active assignments of an active class | yes | yes | yes |
| Read archived assignments | — | own class | all |
| Post / edit / archive assignments, upload files | — | own class, while it is active | all |
| Manage classes, issue invites | — | — | yes |

- Who posted an assignment (`posted_by_name`, `created_by`) is stamped by a
  database trigger from the poster's profile. The client cannot set it.
- A CR exists only through an invite link (`npm run invite`). Claiming is a single
  database transaction that hard-codes the role to `cr` and takes the class from
  the invite. With `--replace <email>`, it also deactivates the outgoing CR.
- Files are stored at `attachments/<class>/<assignment>/…`, at most 25 MB each,
  with the type allow-list enforced by Storage itself. The bucket is public-read
  so students can open files without an account.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run TypeScript without emitting |
| `npm run seed` / `seed:dry` | Sample classes, subjects, assignments and accounts |
| `npm run invite -- <classId>` | Print a single-use CR invite link |
| `npm run bind:superadmin -- <email>` | Make an existing account the superadmin |
| `npm run db:push` | Apply migrations with the Supabase CLI (after `supabase link`) |

## Deploying

Vercel, connected to this repo. `vercel.json` rewrites every path to
`index.html`, so `/class/…`, `/cr` and `/admin` refresh correctly. Schema changes
are applied from your machine (SQL editor or `npm run db:push`), never from a
Vercel build.

> Free Supabase projects **pause after a week with no activity**. A class that
> goes quiet over a holiday will find the site down until the project is
> resumed from the dashboard.

## How it works

```
supabase/migrations/   schema, RLS policies, triggers, invite functions, storage
src/lib/supabase.ts    the one client (URL + anon key)
src/data/rows.ts       database row → UI type mappers
src/data/feed.ts       student reads + live updates
src/data/crRepository.ts   CR reads and writes
src/data/attachments.ts    file validation, upload, removal
src/data/invites.ts    peek / claim an invite
src/auth/              session + profile, friendly error messages
src/utils/             date / status logic, localStorage
```

**Live updates.** Every change to a class's assignments or subjects sends an
empty "changed" broadcast on the topic `class:<id>`, and open dashboards
refetch through row-level security. The broadcast carries no data, so it never
bypasses the security rules.

### Layout

A fixed sidebar on large screens, a slide-in drawer opened by the menu button
next to the logo on small screens. Cards are full-width rows: colour-coded left
bar, a circle to mark done, the assignment details, and the due date on the
right (below the details on phones). Assignments are grouped by status with a
small uppercase label so urgency is readable without relying on colour.

The sidebar lists only Assignments, because Assignments is the only screen.
It closes on selection, on a tap outside it, and on `Escape`.

### Statuses

Status is derived from today's date on every render:

| Status     | Meaning                                        |
| ---------- | ---------------------------------------------- |
| `overdue`  | Due date has passed and it is not completed     |
| `today`    | Due today                                      |
| `soon`     | Due within the next 3 days                    |
| `upcoming` | Due more than 3 days from today                |
| `completed`| Marked done                                    |

Completion always wins: a completed assignment that was overdue is shown as
completed, not as an active overdue task.
