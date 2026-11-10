/**
 * Shared setup for the local admin scripts.
 *
 * These scripts use the **service_role** key, which bypasses row-level security.
 * It is read from `.env.local` (gitignored) or the environment, never from a
 * committed file, and nothing under `src/` may ever import this module.
 *
 *   .env.local
 *     SUPABASE_URL=https://<project-ref>.supabase.co
 *     SUPABASE_SERVICE_ROLE_KEY=<service_role key from Project Settings → API>
 */

import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

export function adminClient() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    fail(
      [
        "Missing Supabase admin credentials.",
        "",
        "Create .env.local in the project root (it is gitignored) with:",
        "  SUPABASE_URL=https://<project-ref>.supabase.co",
        "  SUPABASE_SERVICE_ROLE_KEY=<service_role key>",
        "",
        "Both are in the Supabase dashboard → Project Settings → API.",
        "The service_role key bypasses all security rules: never commit it.",
      ].join("\n  "),
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The auth user with this email, or null. */
export async function findUserByEmail(supabase, email) {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === wanted);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

/** `--name value` from argv, or the fallback. */
export function option(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

/** Positional arguments, skipping `--flag value` pairs. */
export function positionals() {
  const args = process.argv.slice(2);
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith("--")) {
      if (args[i + 1] && !args[i + 1].startsWith("--")) i += 1;
      continue;
    }
    out.push(args[i]);
  }
  return out;
}
