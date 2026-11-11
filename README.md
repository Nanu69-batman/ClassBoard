# ClassBoard

An assignment board for college classes, organised the way Discord organises
servers. Everyone signs up. Anyone can create a class and share its invite link;
classmates join with one click. The owner and the admins they choose post
assignments, with an optional file (PDF, PowerPoint, Word, Excel, text or image).
Everyone sees what is due and ticks work off as they finish it. Those ticks are
saved to their account.

Backend: **Supabase**. Postgres with row-level security holds all the data,
Supabase Auth handles email and Google sign-in, and a private Supabase Storage
bucket holds the files.

## Requirements

- Node.js 20.19+ (or 22.12+)
- A Supabase project (the free plan is enough)

## Setup

1. **Create the schema.** Apply the migrations in `supabase/migrations/` in
   order, either by pasting each one into the SQL Editor or by running
   `npm run db:push` with the Supabase CLI linked. The last migration
   (`20261111000000_accounts_and_classes.sql`) **drops** the tables from the
   earlier anonymous-student design, then creates profiles, classes, memberships,
   completions, the RLS policies and the private `attachments` bucket.
   `20261112000000_subject_teachers_and_files.sql` then adds a teacher to each
   subject and lets an assignment carry several files.
2. **Point the app at the project.** Put the Project URL and the **anon** key
   (Project Settings → API) in `src/lib/supabase.ts`. Both are public by design
   and safe to commit.
3. **Auth settings** (Authentication → URL Configuration): set the Site URL to
   the deployed domain. Add redirect URLs for `http://localhost:5173/**` and
   `https://<your-domain>/**`; Google sign-in and email-confirmation links come
   back through these.
4. **Google sign-in** (optional; Authentication → Providers → Google): add
   a Google OAuth client ID and secret.
5. **Demo data** (optional). Copy `.env.example` to `.env.local` and fill in
   `SUPABASE_URL` and the **service_role** key. That key bypasses every security
   rule, so it stays in `.env.local` (gitignored) and is never used in `src/`.

   ```bash
   npm run seed:dry                         # preview
   SEED_ALLOW_PRODUCTION=1 npm run seed     # owner/admin/member accounts + a demo class
   ```

6. `npm install && npm run dev`, then open <http://localhost:5173>.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Landing page explaining the app, with log in / sign up. Signed-in visitors go to `/app`. |
| `/login`, `/signup` | Email + password or Google. Sign-up asks for the name classmates will see. |
| `/join/<code>` | Invite link. Shows the class and a Join button, after login or sign-up if needed. |
| `/app` | Your classes. The rail on the left lists them, with **+** to create or join one. |
| `/app/<classId>` | A class, with tabs: Assignments, Manage (owner/admin), Members, Settings. |
| `/app/account` | Change your display name, or log out. |

## Who can do what

Enforced by row-level security and database functions in the migration, not by
the frontend.

| | Member | Admin | Owner |
| --- | --- | --- | --- |
| See active assignments, tick them off, see members | yes | yes | yes |
| Post / edit / archive assignments, manage subjects, upload files | — | yes | yes |
| See archived assignments | — | yes | yes |
| Reset the invite link | — | yes | yes |
| Remove members | — | plain members | anyone |
| Promote / demote admins, hand over ownership | — | — | yes |
| Rename or delete the class | — | — | yes |
| Leave the class | yes | yes | after handing over ownership |

- Creating, joining, role changes and invite resets go through database
  functions (`create_class`, `join_class`, `set_member_role`,
  `regenerate_invite_code`). Column-level grants mean a client cannot write a
  role or an invite code directly.
- Who posted an assignment (`posted_by_name`, `created_by`) is stamped by a
  trigger from the poster's profile. The client cannot set it.
- Profiles are created by a trigger on `auth.users`. You can see your own
  profile and those of people you share a class with.
- Completions are private to each person.
- Files are stored at `attachments/<class>/<assignment>/…`, at most 25 MB each.
  The bucket is private: members open files through short-lived signed URLs.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run TypeScript without emitting |
| `npm run seed` / `seed:dry` | Demo accounts and a demo class |
| `npm run db:push` | Apply migrations with the Supabase CLI (after `supabase link`) |

## Deploying

Vercel, connected to this repo. `vercel.json` rewrites every path to
`index.html`, so `/app/…` and `/join/…` refresh correctly. Schema changes are
applied from your machine (SQL editor or `npm run db:push`), never from a
Vercel build.

> Free Supabase projects **pause after a week with no activity**.

## How it works

```
supabase/migrations/      schema, RLS policies, triggers, functions, storage
src/lib/supabase.ts       the one client (URL + anon key)
src/auth/                 session + profile, login guard, friendly error messages
src/data/rows.ts          database row → UI type mappers
src/data/classes.ts       my classes, create / join / leave, roles, invite codes
src/data/classData.ts     one class's assignments, subjects, members, my ticks
src/data/assignments.ts   posting, editing, archiving; subjects
src/data/attachments.ts   file validation, upload, removal, signed URLs
src/data/realtime.ts      "something changed" pings
src/pages/                landing, auth, join, app layout, class, account
src/components/class/     the class page's tabs
src/utils/                date / status logic
```

**Live updates.** Every change to a class's assignments, subjects or members
sends an empty "changed" broadcast on `class:<id>`. A change to someone's
memberships also pings `user:<id>`, so their class rail updates. Clients refetch
through row-level security, so a broadcast never carries data.

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
