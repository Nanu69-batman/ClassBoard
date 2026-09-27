# ClassBoard

A simple, local-first assignment dashboard for a college student.

Open ClassBoard and you immediately see what you have, what is due, and what you
have already finished. There is no backend, no account and no database.

## Requirements

- Node.js 20.19+ (or 22.12+)
- npm

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints, usually <http://localhost:5173>.

The app runs with no configuration — it falls back to the bundled sample
assignments. To connect a real Firebase project, see [Configuration](#configuration).

## Configuration

ClassBoard talks to Firebase for shared data. The app still builds and runs
without it; the student dashboard falls back to local sample data.

```bash
cp .env.example .env
```

Then fill `.env` with the six values from **Firebase console → Project settings →
Your apps → your web app → SDK setup and configuration → Config**.

> **Windows note:** save `.env` as **plain UTF-8, without a BOM**. PowerShell's
> `Out-File -Encoding utf8` and older Notepad add a BOM by default, which
> silently corrupts the first variable name so that one value never loads. If a
> value is missing from `.env` but you can see it in the file, this is why — the
> app's error message says so too.

These six values are public by design and ship in every browser bundle. The
access boundary is Firestore/Storage Security Rules, not the config. The
genuinely private file is the service-account JSON, which is ignored by git and
used only by the local seed script.

Only variables prefixed `VITE_` reach the browser, so never prefix a secret
with `VITE_`.

### Deploying

| What | Where |
| --- | --- |
| The website | Vercel, connected to this repo. `vercel.json` handles the SPA rewrite so `/cr` and `/admin` refresh correctly. |
| Firebase env vars | Vercel → Settings → Environment Variables, for Production and Preview |
| Security rules | Your machine: `npm run firebase:deploy:rules` |

Rules deliberately do **not** deploy from Vercel — they are published with the
Firebase CLI.

## Scripts

| Script                        | What it does                        |
| ----------------------------- | ----------------------------------- |
| `npm run dev`                 | Start the development server        |
| `npm run build`               | Type-check and build for production |
| `npm run preview`             | Serve the production build locally  |
| `npm run typecheck`           | Run TypeScript without emitting     |
| `npm run firebase:login`      | Log the Firebase CLI into your account |
| `npm run firebase:deploy:rules` | Publish `firestore.rules` and `storage.rules` |
| `npm run firebase:emulators`  | Run the local Auth/Firestore/Storage emulators |

## How it works

Assignments are **application data** and live in `src/data/assignments.ts`.
Completion is **personal state** and lives in `localStorage` under the key
`classboard_completed_assignments` as a JSON array of assignment ids.

The two are never mixed. Marking an assignment done never modifies the
assignment itself, so the assignment list can later be replaced by a backend
without touching the completion state.

```
src/
  data/assignments.ts        assignment definitions (the content)
  utils/assignmentStatus.ts  all date / status logic, counting, grouping
  utils/storage.ts           localStorage read + write
  hooks/useAssignmentStatus  completion state, persisted
  components/                Sidebar, TopBar, Greeting, StatCards, FilterBar,
                             AssignmentList, AssignmentCard, EmptyState, icons
  styles/index.css           all styling
  App.tsx                    search + filters and composition
```

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

### Sample data

`src/data/assignments.ts` writes its due dates as offsets from today
(`isoDateFromToday(-2)`, `isoDateFromToday(0)`, …) so the dashboard always has
overdue, due-today, due-soon and upcoming examples to look at. Replace those
calls with fixed ISO date strings when real data arrives.

The **Completed** section only appears once you mark something as done — click
any **Mark as Done** button to see it. Completion is stored per browser, so it
survives refreshes and restarts.

To reset the sample data, clear the key in DevTools:

```js
localStorage.removeItem("classboard_completed_assignments");
```

## Not in this version

By design, there is no authentication, backend, database, notifications,
assignment creation/editing UI, or multi-user support. The assignment list is
the only place content is defined.
