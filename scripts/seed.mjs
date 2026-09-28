/**
 * Seeds a local Firebase project with classes, subjects, assignments and the
 * accounts needed to try the CR and superadmin dashboards.
 *
 * Why this exists: creating a Firebase Auth user needs the Admin SDK, and the
 * Admin SDK is server-side. It works fine from a laptop against the free Spark
 * plan, so this is the "secure server" for setup purposes — it just never ships
 * to the browser.
 *
 * It refuses to run against the live project unless SEED_ALLOW_PRODUCTION=1 is
 * set, and it generates a random password for every account rather than shipping
 * a default one (§34).
 *
 * Usage:
 *   1. Firebase console -> Project settings -> Service accounts ->
 *      "Generate new private key". Save it somewhere outside the repo.
 *   2. Set FIREBASE_SERVICE_ACCOUNT to its path, or drop it at ./service-account.json
 *   3. npm run seed            (add --dry-run to preview without writing)
 *
 * Re-running is safe: accounts are reused, documents are merged.
 */

import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "classboard-de77d";

const DRY_RUN = process.argv.includes("--dry-run");
const ALLOW_PRODUCTION = process.env.SEED_ALLOW_PRODUCTION === "1";

const SERVICE_ACCOUNT_CANDIDATES = [
  process.env.FIREBASE_SERVICE_ACCOUNT,
  "service-account.json",
  "scripts/service-account.json",
].filter(Boolean);

function findServiceAccount() {
  for (const candidate of SERVICE_ACCOUNT_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const path = findServiceAccount();
if (!path) {
  fail(
    [
      "No service account found.",
      "",
      "Download one: Firebase console -> Project settings -> Service accounts ->",
      '"Generate new private key". Then either',
      "  - set FIREBASE_SERVICE_ACCOUNT to the file's path, or",
      "  - copy the file to ./service-account.json (it is gitignored).",
    ].join("\n  "),
  );
}

if (PROJECT_ID === process.env.GCLOUD_PROJECT) {
  fail("Refusing to seed the live project. Set SEED_ALLOW_PRODUCTION=1 if you mean it.");
}

if (!ALLOW_PRODUCTION && !DRY_RUN) {
  console.log(
    "\n  This writes to the real project " +
      PROJECT_ID +
      ".\n  Re-run with --dry-run to preview, or SEED_ALLOW_PRODUCTION=1 to apply.\n",
  );
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(readFileSync(path, "utf8"))),
  projectId: PROJECT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

const now = FieldValue.serverTimestamp();

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

async function upsertAccount(account, generated) {
  let record;
  try {
    record = await auth.getUserByEmail(account.email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    if (DRY_RUN) return { ...account, uid: "(new)", password: generated, created: true };
    record = await auth.createUser({
      email: account.email,
      password: generated,
      emailVerified: true,
      displayName: account.name,
    });
  }

  if (DRY_RUN) return { ...account, uid: record.uid, password: "(existing)", created: false };

  await db.doc(`users/${record.uid}`).set(
    {
      email: account.email,
      displayName: account.name,
      role: account.role,
      classId: account.classId,
      active: true,
      createdAt: now,
    },
    { merge: true },
  );

  return { ...account, uid: record.uid, password: generated, created: true };
}

async function main() {
  const mode = DRY_RUN ? "DRY RUN — nothing written" : `WRITING to ${PROJECT_ID}`;

  console.log(`\n  ClassBoard seed — ${mode}`);
  console.log(`  service account: ${path}\n`);

  const generated = {};
  const results = [];
  for (const account of ACCOUNTS) {
    const password = makePassword();
    generated[account.key] = password;
    results.push(await upsertAccount(account, password));
  }

  for (const each of CLASSES) {
    if (!DRY_RUN) {
      await db.doc(`classes/${each.id}`).set({ ...each, createdAt: now }, { merge: true });
    }
  }

  for (const [classId, subjects] of Object.entries(SUBJECTS)) {
    for (const [id, name, shortName] of subjects) {
      if (!DRY_RUN) {
        await db.doc(`classes/${classId}/subjects/${id}`).set({ name, shortName, active: true }, { merge: true });
      }
    }
  }

  for (const [classId, subjectId, title, description, offset, priority] of ASSIGNMENTS) {
    const subjectName = SUBJECTS[classId].find((s) => s[0] === subjectId)[1];
    const crEmail = ACCOUNTS.find((a) => a.classId === classId)?.email;
    const crName = ACCOUNTS.find((a) => a.classId === classId)?.name ?? "Unassigned";
    if (!DRY_RUN) {
      await db.collection(`classes/${classId}/assignments`).add({
        subjectId,
        subjectName,
        title,
        description,
        dueDate: isoDateFromToday(offset),
        priority,
        attachmentUrl: null,
        attachmentName: null,
        contactEmail: null,
        createdBy: crEmail ?? "unassigned",
        postedByName: crName,
        createdAt: now,
        updatedAt: now,
        active: true,
      });
    }
  }

  console.log(`  ${CLASSES.length} classes, ${Object.values(SUBJECTS).flat().length} subjects, ${ASSIGNMENTS.length} assignments\n`);

  if (DRY_RUN) {
    console.log("  Accounts that would exist:");
    for (const account of ACCOUNTS) console.log(`    ${account.email}  (${account.role})`);
    console.log("\n  Nothing was written.\n");
    return;
  }

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

main().then(
  () => process.exit(0),
  (error) => {
    console.error("\n  Seed failed:", error?.message ?? error, "\n");
    process.exit(1);
  },
);
