/**
 * Issues a CR invite link for a class.
 *
 *   npm run invite -- <classId>
 *   npm run invite -- <classId> --replace <outgoing-cr-email>   (transfer)
 *   npm run invite -- <classId> --days 3 --base https://classboard.example
 *
 * Whoever opens the link first and signs in becomes a CR of that class. With
 * --replace, the named CR is deactivated in the same transaction as the claim.
 *
 * Stopgap until the superadmin dashboard (M8) can issue invites in the app.
 */

import { adminClient, fail, findUserByEmail, option, positionals } from "./lib/admin.mjs";

const [classId] = positionals();
if (!classId) fail("Usage: npm run invite -- <classId> [--replace <email>] [--days 7] [--base <url>]");

const days = Number(option("days", "7"));
if (!Number.isFinite(days) || days <= 0 || days > 30) fail("--days must be between 1 and 30.");

const base = option("base", "http://localhost:5173").replace(/\/+$/, "");
const replaceEmail = option("replace");

const supabase = adminClient();

const { data: cls, error: classError } = await supabase
  .from("classes")
  .select("id, display_name, active")
  .eq("id", classId)
  .maybeSingle();

if (classError) fail(`Could not read the class: ${classError.message}`);
if (!cls) fail(`No class with id "${classId}".`);
if (!cls.active) fail(`"${classId}" is deactivated. Reactivate it first.`);

let replaces = null;
if (replaceEmail) {
  const user = await findUserByEmail(supabase, replaceEmail);
  if (!user) fail(`No account with email ${replaceEmail}.`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, class_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "cr" || profile.class_id !== classId) {
    fail(`${replaceEmail} is not a CR of ${classId}.`);
  }
  replaces = profile.id;
}

const { data: invite, error } = await supabase
  .from("cr_invites")
  .insert({
    class_id: classId,
    replaces,
    expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
  })
  .select("token, expires_at")
  .single();

if (error) fail(`Could not create the invite: ${error.message}`);

console.log(`\n  Invite for ${cls.display_name}${replaceEmail ? ` (replaces ${replaceEmail})` : ""}`);
console.log(`  Expires ${new Date(invite.expires_at).toLocaleString()}\n`);
console.log(`  ${base}/invite?invite=${invite.token}\n`);
console.log("  Single use. Anyone holding this link can claim it — send it only to the new CR.\n");
