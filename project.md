# ClassBoard

A simple, local-first assignment dashboard for a college student.

## 1. Project Goal

Build a clean, responsive website called **ClassBoard** that lets one student view and manage their college assignments in one place.

The first version is intentionally small.

The website is currently **personal-use only**. There is no backend, authentication, database, multi-user functionality, or CR dashboard.

The goal is simply:

> Open ClassBoard → immediately see what assignments I have → know what is due → mark things as done.

Do not build features that are not required by this document.

---

# 2. V1 Scope

### Must have

* Assignment dashboard
* Assignment cards
* Subject
* Assignment title
* Description
* Due date
* Priority
* Optional attachment/link
* Overdue detection
* Due-soon detection
* Upcoming assignments
* Completed assignments
* Mark assignment as completed
* Mark assignment as pending again
* Assignment filtering
* Assignment search
* Persistent completion status using `localStorage`
* Responsive/mobile-friendly UI

### Explicitly NOT required

Do NOT implement:

* Authentication
* User accounts
* Registration
* Backend
* Database
* API
* Cloud storage
* CR accounts
* Teacher accounts
* Admin panel
* Multi-user support
* Notifications
* Email
* WhatsApp integration
* Push notifications
* Assignment creation UI
* Assignment editing UI
* Assignment deletion UI
* Server-side storage
* Complex state management
* Payments
* AI features

Assignments will initially be defined locally in the project.

---

# 3. Core Concept

The assignment information is application data.

The student's completion state is personal local state.

Keep these separate.

Example assignment:

```js
{
  id: "math-001",
  subject: "Engineering Mathematics",
  title: "Assignment 2",
  description: "Solve questions 1-10 from Unit 2.",
  dueDate: "2026-09-28",
  priority: "high",
  attachment: null
}
```

Completion state should NOT modify the assignment object.

Instead, store completed assignment IDs in localStorage.

Example:

```js
[
  "math-001",
  "physics-003"
]
```

Use a stable assignment ID as the key.

---

# 4. Suggested Project Structure

Use a simple structure appropriate for the chosen frontend framework.

If starting from scratch, prefer:

* React
* TypeScript
* Vite
* CSS or a lightweight styling solution

Avoid unnecessary libraries.

Suggested structure:

```text
classboard/
│
├── public/
│
├── src/
│   ├── components/
│   │   ├── AssignmentCard
│   │   ├── AssignmentList
│   │   ├── FilterBar
│   │   ├── Header
│   │   └── EmptyState
│   │
│   ├── data/
│   │   └── assignments.ts
│   │
│   ├── hooks/
│   │   └── useAssignmentStatus.ts
│   │
│   ├── utils/
│   │   ├── assignmentStatus.ts
│   │   └── storage.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── styles/
│       └── ...
│
├── package.json
└── README.md
```

The exact structure can be adjusted if the chosen stack benefits from a different organization.

Do not create unnecessary abstractions.

---

# 5. Assignment Data

Create a local assignment dataset containing realistic sample assignments.

Use several subjects relevant to a first-year B.Tech ECE student, for example:

* Engineering Mathematics
* Physics
* Basic Electrical Engineering
* Programming
* Electronics
* Engineering Drawing

Include enough assignments to demonstrate:

* overdue assignments
* assignments due today
* assignments due tomorrow
* assignments due within the next few days
* assignments further in the future
* completed assignments

Use stable unique IDs.

Example:

```ts
export type Assignment = {
  id: string;
  subject: string;
  title: string;
  description: string;
  dueDate: string;
  priority: "low" | "normal" | "high";
  attachment?: string | null;
};
```

Use ISO date strings where possible.

Example:

```text
2026-09-28
```

---

# 6. Dashboard

The dashboard is the main screen.

The first thing the user should understand is:

> What do I need to do?

Header:

```text
ClassBoard
ECE • 1st Year
```

Below it, show a compact summary such as:

```text
5 pending • 2 completed
```

Then display assignments grouped by status.

Recommended order:

1. Overdue
2. Due Today
3. Due Soon
4. Upcoming
5. Completed

Do not show empty sections unless they improve the UX.

---

# 7. Assignment Card

Each assignment card should display:

* Subject
* Title
* Description
* Due date
* Relative due text
* Priority
* Completion state
* Attachment/link if available
* Action to mark complete/pending

Example:

```text
Engineering Mathematics

Assignment 2

Solve questions 1-10 from Unit 2.

Due tomorrow
High priority

[ Mark as Done ]
```

For a completed assignment:

```text
Engineering Mathematics

Assignment 2

Solve questions 1-10 from Unit 2.

✓ Completed

[ Mark as Pending ]
```

Completed cards should visually appear less prominent, but remain accessible.

---

# 8. Date Logic

The application should automatically calculate assignment status based on the current date.

Statuses:

```text
overdue
today
soon
upcoming
completed
```

Important:

Completion status takes precedence visually.

If an assignment is overdue but completed, show it as completed rather than displaying it as an active overdue task.

Suggested definitions:

### Overdue

Due date is before today and assignment is not completed.

### Due Today

Due date is today.

### Due Soon

Due within the next 3 days.

### Upcoming

Due more than 3 days from today.

Keep the date logic in a reusable utility rather than scattering it throughout UI components.

---

# 9. LocalStorage

Use browser `localStorage` for completion state.

Suggested key:

```text
classboard_completed_assignments
```

Stored value:

```json
["math-001", "physics-002"]
```

Create a small storage utility instead of directly accessing localStorage from every component.

Requirements:

* Load completion state on startup.
* Save whenever completion state changes.
* Handle missing localStorage data gracefully.
* Handle malformed localStorage data gracefully.
* Never crash the application because localStorage contains invalid data.

The application must work without a backend.

---

# 10. Filters

Provide simple filters.

Minimum:

```text
All
Pending
Completed
```

Also provide subject filtering if it can be implemented cleanly.

Example:

```text
[ All Subjects ▼ ]
```

Search should search at least:

* assignment title
* subject
* description

Search should update the visible list immediately.

---

# 11. Sorting

Within active sections, sort assignments by due date.

Earlier deadlines should appear first.

For the same due date, higher-priority assignments can appear first.

Do not create complicated ranking logic.

---

# 12. UI / Visual Direction

ClassBoard should feel like a modern productivity app rather than a college ERP.

Design characteristics:

* Clean
* Minimal
* Modern
* Fast
* Spacious
* Highly readable
* Mobile-first
* Desktop-friendly
* Subtle visual hierarchy
* Rounded cards
* Clear typography
* Restrained use of color

Avoid:

* excessive gradients
* excessive animations
* glassmorphism everywhere
* huge hero sections
* unnecessary illustrations
* excessive shadows
* clutter
* dashboard-style charts

The assignment information is the hero.

Use color primarily to communicate status:

* overdue
* due soon
* completed
* priority

Do not make the interface visually noisy.

---

# 13. Responsive Design

The site must work well on:

### Mobile

This is the primary use case.

Assignment cards should fit comfortably on a phone screen.

### Desktop

Use available horizontal space without making cards unnecessarily wide.

A reasonable desktop layout could use a centered content container.

Do not build separate mobile and desktop applications.

Use responsive CSS.

---

# 14. Interactions

Marking an assignment as done should feel immediate.

When the user clicks:

```text
Mark as Done
```

the card should immediately update.

The state must survive:

* page refresh
* browser restart
* reopening the website

When the user clicks:

```text
Mark as Pending
```

the assignment should return to the active list.

Avoid unnecessary confirmation dialogs.

---

# 15. Assignment Details

The first version can keep everything on the card.

If an assignment has a long description, provide a simple way to expand it.

Do not build a complicated routing system unless it is genuinely useful.

Attachments can simply be links.

Example:

```ts
attachment: "/files/math-assignment-2.pdf"
```

or:

```ts
attachment: "https://..."
```

If there is no attachment, do not show an attachment control.

---

# 16. Empty States

Handle empty states cleanly.

For example:

### No pending assignments

```text
You're all caught up 🎉

No pending assignments.
```

### No search results

```text
No assignments found.

Try a different search.
```

### No completed assignments

Do not make this feel like an error.

---

# 17. Accessibility

Use semantic HTML where appropriate.

Requirements:

* Buttons should be actual buttons.
* Inputs should have labels/placeholders.
* Interactive elements should be keyboard accessible.
* Sufficient text contrast.
* Do not rely only on color to communicate status.
* Use visible focus states.

---

# 18. Performance

This application is intentionally small.

Do not over-engineer performance.

Avoid:

* unnecessary state libraries
* complex caching
* unnecessary network requests
* backend infrastructure
* excessive dependencies

The website should load quickly.

---

# 19. Architecture Principles

Keep responsibilities separated.

### Data

Contains assignment definitions.

### Utilities

Contains date/status logic and localStorage helpers.

### Hooks/state

Handles completion state.

### Components

Render the UI.

### App

Composes the application.

Do not put the entire application inside one giant component.

At the same time, do not create dozens of tiny abstractions for trivial operations.

Prefer simple, understandable code.

---

# 20. Future Direction

The current implementation must make it possible to later replace local assignment data with a backend.

Potential future architecture:

```text
Current

assignments.ts
      ↓
ClassBoard UI
      ↓
localStorage
```

Later:

```text
CR dashboard
      ↓
Backend/API
      ↓
Database
      ↓
ClassBoard UI
      ↓
localStorage for personal completion state
```

Do NOT implement the future architecture now.

Only avoid design choices that would make such an upgrade unnecessarily painful.

---

# 21. Sample Content

Populate the application with realistic sample data.

Example:

```text
Engineering Mathematics
Assignment 2
Solve questions 1-10 from Unit 2.
Due: 2026-09-28
Priority: High
```

```text
Physics
Lab Record 3
Complete Experiment 3 and attach observations.
Due: 2026-09-30
Priority: Normal
```

```text
Basic Electrical Engineering
Tutorial Sheet 1
Complete the numerical problems from Unit 1.
Due: 2026-10-01
Priority: Normal
```

```text
Programming
Assignment 2
Implement the given array problems.
Due: 2026-10-03
Priority: High
```

Add several more examples so every dashboard state can be tested.

---

# 22. Definition of Done

The project is complete when:

* The application runs locally.
* The dashboard displays assignments.
* Assignments are grouped by deadline/status.
* Overdue assignments are detected automatically.
* Today's assignments are identified.
* Upcoming assignments are displayed.
* Assignments can be marked completed.
* Assignments can be marked pending again.
* Completion status persists through page refresh.
* Completion status persists after closing and reopening the browser.
* Search works.
* Filters work.
* Subject information is visible.
* Priority is visible.
* The layout works on mobile and desktop.
* There are no console errors during normal usage.
* The UI looks polished enough to actually use every day.

---

# 23. Important Scope Rule

**Do not expand the product beyond this specification without being asked.**

If you think of features such as:

* login
* accounts
* database
* notifications
* reminders
* AI
* CR dashboard
* teacher dashboard
* WhatsApp integration
* analytics
* calendars
* cloud synchronization

do not implement them.

The purpose of this version is to create the smallest useful version of ClassBoard and validate the core workflow first.

Build it cleanly, keep it simple, and make the daily experience excellent.
