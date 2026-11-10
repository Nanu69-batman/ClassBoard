/**
 * Makes an existing account the superadmin.
 *
 *   npm run bind:superadmin -- <email> [--name "Display name"]
 *
 * The root of trust. The first superadmin cannot come from an invite — that
 * would let anyone mint one — so it is bound here, locally, with the
 * service-role key. Sign in once first (Google, or an email account created in
 * the Supabase dashboard → Authentication → Users), then run this.
 *
 * Never add an in-app equivalent of this script.
 */

import { adminClient, fail, findUserByEmail, option, positionals } from "./lib/admin.mjs";

const [email] = positionals();
if (!email) fail('Usage: npm run bind:superadmin -- <email> [--name "Display name"]');

const supabase = adminClient();

const user = await findUserByEmail(supabase, email);
if (!user) {
  fail(
    `No account with email ${email}. Sign in once with Google, or create the user in ` +
      "Supabase dashboard → Authentication → Users, then re-run.",
  );
}

const displayName = option("name", user.user_metadata?.full_name || "Superadmin");

const { error } = await supabase.from("profiles").upsert({
  id: user.id,
  email: user.email,
  display_name: displayName,
  role: "superadmin",
  class_id: null,
  active: true,
});

if (error) fail(`Could not bind: ${error.message}`);

console.log(`\n  ${email} is now the superadmin (${displayName}).\n`);
