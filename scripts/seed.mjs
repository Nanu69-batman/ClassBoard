/**
 * Seeds a Supabase project with demo accounts and one class to click around in.
 *
 * Uses the service_role key from .env.local (see scripts/lib/admin.mjs). It
 * bypasses row-level security, so this only ever runs from your own machine.
 *
 * Creates three accounts (owner, admin, member), a class with subjects and
 * assignments, and adds all three to it. Every new account gets a freshly
 * generated password, printed once.
 *
 *   npm run seed:dry     preview, writes nothing
 *   npm run seed         apply (asks for SEED_ALLOW_PRODUCTION=1)
 *
 * Re-running is safe: existing accounts keep their password, and the demo class
 * is only created if the owner doesn't already have one with the same name.
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

const CLASS_NAME = "ECE 2026 · Section A";
const SUBJECTS = ["Engineering Mathematics", "Physics", "Programming", "Electronics"];

const ACCOUNTS = [
  { email: "owner@classboard.test", name: "Asha Rao", role: "owner" },
  { email: "admin@classboard.test", name: "Bhavya Iyer", role: "admin" },
  { email: "member@classboard.test", name: "Chetan Das", role: "member" },
];

const ASSIGNMENTS = [
  ["Engineering Mathematics", "Assignment 1", "Complete questions 1-15 from Unit 1 and show all working.", -3, "high"],
  ["Physics", "Lab Record 2", "Complete Experiment 2 on the moment of inertia of a disc.", 0, "normal"],
  ["Programming", "Linked lists", "Write C programs for the linked-list problems in the lab manual.", 2, "normal"],
  ["Electronics", "Diode characteristics", "Plot the V-I curve of a silicon diode and mark the knee voltage.", 6, "low"],
];

function isoDateFromToday(offsetDays) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function makePassword() {
  const words = ["orbit", "quartz", "meadow", "harbor", "cinder", "vellum", "nimbus", "thistle"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  return `${pick()}-${pick()}-${randomBytes(2).toString("hex")}`;
}

function check(result, what) {
  if (result.error) fail(`${what}: ${result.error.message}`);
  return result.data;
}

async function ensureAccount(account) {
  const existing = await findUserByEmail(supabase, account.email);
  if (existing) return { ...account, id: existing.id, password: "(existing — unchanged)" };

  const password = makePassword();
  const { user } = check(
    await supabase.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      // The profile trigger reads this.
      user_metadata: { display_name: account.name },
    }),
    `create ${account.email}`,
  );
  return { ...account, id: user.id, password };
}

async function main() {
  console.log(`\n  ClassBoard seed — ${DRY_RUN ? "dry run" : "applying"}\n`);

  if (DRY_RUN) {
    console.log(`  Class "${CLASS_NAME}" with ${SUBJECTS.length} subjects and ${ASSIGNMENTS.length} assignments`);
    for (const account of ACCOUNTS) console.log(`    ${account.email}  (${account.role})`);
    console.log("\n  Nothing was written.\n");
    return;
  }

  const accounts = [];
  for (const account of ACCOUNTS) accounts.push(await ensureAccount(account));
  const owner = accounts.find((each) => each.role === "owner");

  // Does the owner already have the demo class?
  const owned = check(
    await supabase
      .from("class_members")
      .select("class_id, classes(name)")
      .eq("user_id", owner.id)
      .eq("role", "owner"),
    "look up classes",
  );
  let classId = owned.find((row) => row.classes?.name === CLASS_NAME)?.class_id;

  if (!classId) {
    const created = check(
      await supabase.from("classes").insert({ name: CLASS_NAME, description: "Demo class" }).select("id").single(),
      "create class",
    );
    classId = created.id;

    const subjects = check(
      await supabase
        .from("subjects")
        .insert(["General", ...SUBJECTS].map((name) => ({ class_id: classId, name })))
        .select("id, name"),
      "subjects",
    );
    const subjectId = Object.fromEntries(subjects.map((row) => [row.name, row.id]));

    const admin = accounts.find((each) => each.role === "admin");
    check(
      await supabase.from("assignments").insert(
        ASSIGNMENTS.map(([subject, title, description, offset, priority]) => ({
          class_id: classId,
          subject_id: subjectId[subject],
          title,
          description,
          due_date: isoDateFromToday(offset),
          priority,
          created_by: admin.id,
          posted_by_name: admin.name,
        })),
      ),
      "assignments",
    );
  }

  check(
    await supabase
      .from("class_members")
      .upsert(accounts.map((each) => ({ class_id: classId, user_id: each.id, role: each.role })), {
        onConflict: "class_id,user_id",
      }),
    "memberships",
  );

  const { invite_code: code } = check(
    await supabase.from("classes").select("invite_code").eq("id", classId).single(),
    "invite code",
  );

  console.log(`  Class "${CLASS_NAME}" — invite code ${code}\n`);
  for (const account of accounts) {
    console.log(`    ${account.role.padEnd(6)}  ${account.email}  ${account.password}`);
  }
  console.log("\n  New passwords are shown once and are not stored anywhere.\n");
}

await main();
