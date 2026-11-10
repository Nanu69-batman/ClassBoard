/**
 * Seeds a Supabase project with classes, subjects, assignments and the
 * accounts needed to try the CR and superadmin dashboards.
 *
 * Uses the service_role key from .env.local (see scripts/lib/admin.mjs). It
 * bypasses row-level security, so this only ever runs from your own machine.
 *
 * Every account gets a freshly generated password, printed once, rather than a
 * default one (§34).
 *
 *   npm run seed:dry     preview, writes nothing
 *   npm run seed         apply (asks for SEED_ALLOW_PRODUCTION=1)
 *
 * Re-running is safe: classes, subjects and profiles are upserted, existing
 * accounts keep their password, and a class that already has assignments gets
 * no more.
 */

import { randomBytes } from "node:crypto";

import { adminClient, fail, findUserByEmail } from "./lib/admin.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const ALLOW = process.env.SEED_ALLOW_PRODUCTION === "1";

if (!ALLOW && !DRY_RUN) {
  console.log(
    "\n  This writes to your Supabase project.\n" +
      "  Re-run with --dry-run to preview, or set SEED_ALLOW_PRODUCTION=1 to apply.\n",
  );
  process.exit(1);
}

const supabase = adminClient();

/** ISO date, N days from today, so the sample always covers every state. */
function isoDateFromToday(offsetDays) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makePassword() {
  // Readable enough to retype, random enough that nothing is a default.
  const words = ["orbit", "quartz", "meadow", "harbor", "cinder", "vellum", "nimbus", "thistle"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  return `${pick()}-${pick()}-${randomBytes(2).toString("hex")}`;
}

const CLASSES = [
  {
    id: "ece-2026-a",
    name: "ECE",
    batch: "2026",
    section: "A",
    displayName: "ECE • 2026 • Section A",
    active: true,
  },
  {
    id: "cse-2026-a",
    name: "CSE",
    batch: "2026",
    section: "A",
    displayName: "CSE • 2026 • Section A",
    active: true,
  },
  {
    id: "it-2026-b",
    name: "IT",
    batch: "2026",
    section: "B",
    displayName: "IT • 2026 • Section B",
    active: false,
  },
];

const SUBJECTS = {
  "ece-2026-a": [
    ["maths", "Engineering Mathematics", "Maths"],
    ["physics", "Physics", "Physics"],
    ["eee", "Basic Electrical Engineering", "EEE"],
    ["prog", "Programming", "Prog"],
    ["electronics", "Electronics", "Electronics"],
    ["drawing", "Engineering Drawing", "Drawing"],
  ],
  "cse-2026-a": [
    ["os", "Operating Systems", "OS"],
    ["networks", "Computer Networks", "Networks"],
    ["dbms", "Database Management Systems", "DBMS"],
  ],
  "it-2026-b": [["it-101", "Introduction to Information Technology", "IT-101"]],
};

const ASSIGNMENTS = [
  ["ece-2026-a", "maths", "Assignment 1", "Complete questions 1-15 from Unit 1 and show all working.", -4, "high"],
  ["ece-2026-a", "physics", "Lab Record 2", "Complete Experiment 2 on the moment of inertia of a disc.", -2, "normal"],
  ["ece-2026-a", "maths", "Assignment 2", "Solve questions 1-10 from Unit 2.", 0, "high"],
  ["ece-2026-a", "prog", "Assignment 1", "Write C programs for the linked-list problems in the lab manual.", -1, "normal"],
  ["ece-2026-a", "eee", "Tutorial Sheet 1", "Complete the numerical problems from Unit 1 on network theorems.", 2, "normal"],
  ["ece-2026-a", "electronics", "Diode Characteristics Lab", "Plot the V-I characteristics of a silicon diode and mark the knee voltage.", 1, "normal"],
  ["cse-2026-a", "os", "Process Scheduling Assignment", "Solve the given problems on FCFS, SJF and Round Robin.", 1, "high"],
  ["cse-2026-a", "networks", "Client-Server Model Notes", "Prepare short notes on the client-server model with diagrams.", 4, "normal"],
  ["cse-2026-a", "dbms", "Database Normalization", "Convert the given relations to 3NF.", -6, "high"],
  ["cse-2026-a", "networks", "TCP/IP Worksheet", "Complete the worksheet and submit in class.", -3, "normal"],
  ["cse-2026-a", "dbms", "SQL Practice Set", "Answer questions 1-20 from the practice set.", 5, "low"],
  ["it-2026-b", "it-101", "Hardware Overview", "Read chapter 1 and summarise the bus structures.", 7, "low"],
];

const ACCOUNTS = [
  { key: "admin", email: "admin@classboard.test", role: "superadmin", classId: null, name: "Superadmin" },
  { key: "cr-ece", email: "cr.ece@classboard.test", role: "cr", classId: "ece-2026-a", name: "Asha Rao" },
  { key: "cr-cse", email: "cr.cse@classboard.test", role: "cr", classId: "cse-2026-a", name: "Bhavya Iyer" },
  // Deliberately no CR for it-2026-b, so the admin can show a class needing one.
];

function check(result, what) {
  if (result.error) fail(`${what}: ${result.error.message}`);
  return result.data;
}

async function upsertAccount(account, password) {
  const existing = await findUserByEmail(supabase, account.email);
  if (DRY_RUN) {
    return { ...account, uid: existing?.id ?? "(new)", password: existing ? "(existing)" : password, created: !existing };
  }

  let user = existing;
  if (!user) {
    user = check(
      await supabase.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      }),
      `create ${account.email}`,
    ).user;
  }

  check(
    await supabase.from("profiles").upsert({
      id: user.id,
      email: account.email,
      display_name: account.name,
      role: account.role,
      class_id: account.classId,
      active: true,
    }),
    `profile for ${account.email}`,
  );

  return { ...account, uid: user.id, password: existing ? "(existing)" : password, created: !existing };
}

async function main() {
  console.log(`\n  ClassBoard seed — ${DRY_RUN ? "dry run" : "applying"}\n`);

  if (DRY_RUN) {
    console.log(`  ${CLASSES.length} classes, ${Object.values(SUBJECTS).flat().length} subjects, ${ASSIGNMENTS.length} assignments`);
    console.log("  Accounts that would exist:");
    for (const account of ACCOUNTS) console.log(`    ${account.email}  (${account.role})`);
    console.log("\n  Nothing was written.\n");
    return;
  }

  // Classes
  check(
    await supabase.from("classes").upsert(
      CLASSES.map(({ displayName, ...rest }) => ({ ...rest, display_name: displayName })),
    ),
    "classes",
  );

  // Subjects, keyed by (class, slug) so assignments can find them
  const subjectIds = {};
  for (const [classId, list] of Object.entries(SUBJECTS)) {
    const rows = check(
      await supabase
        .from("subjects")
        .upsert(
          list.map(([, name, shortName]) => ({ class_id: classId, name, short_name: shortName, active: true })),
          { onConflict: "class_id,name" },
        )
        .select("id, name"),
      `subjects for ${classId}`,
    );
    for (const [slug, name] of list) {
      subjectIds[`${classId}/${slug}`] = rows.find((row) => row.name === name)?.id;
    }
  }

  // Accounts
  const results = [];
  for (const account of ACCOUNTS) {
    results.push(await upsertAccount(account, makePassword()));
  }
  const crByClass = Object.fromEntries(
    results.filter((each) => each.role === "cr").map((each) => [each.classId, each]),
  );

  // Assignments — only for classes that have none yet, so a re-run never doubles them
  let inserted = 0;
  for (const cls of CLASSES) {
    const { count } = await supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("class_id", cls.id);
    if (count) continue;

    const rows = ASSIGNMENTS.filter(([classId]) => classId === cls.id).map(
      ([classId, slug, title, description, offset, priority]) => ({
        class_id: classId,
        subject_id: subjectIds[`${classId}/${slug}`],
        title,
        description,
        due_date: isoDateFromToday(offset),
        priority,
        created_by: crByClass[classId]?.uid ?? null,
        posted_by_name: crByClass[classId]?.name ?? "Class representative",
        active: true,
      }),
    );
    if (rows.length === 0) continue;

    check(await supabase.from("assignments").insert(rows), `assignments for ${cls.id}`);
    inserted += rows.length;
  }

  console.log(`  ${CLASSES.length} classes, ${Object.values(SUBJECTS).flat().length} subjects, ${inserted} new assignments\n`);
  console.log("  Sign-in details:\n");
  for (const result of results) {
    const label = result.role === "superadmin" ? "superadmin" : `CR for ${result.classId}`;
    console.log(`    ${label}`);
    console.log(`      email:    ${result.email}`);
    console.log(`      password: ${result.password}`);
    console.log(`      ${result.created ? "created" : "already existed (password unchanged, reset it if needed)"}`);
    console.log("");
  }
  console.log("  These passwords are shown once and are not stored anywhere.\n");
}

await main();
