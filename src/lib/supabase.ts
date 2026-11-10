/**
 * The one Supabase client.
 *
 * ## Why these values are committed
 *
 * The project URL and the anon key are public by design: they ship in the
 * browser bundle, so anyone loading the site already has them. What protects the
 * data is row-level security in `supabase/migrations/`, not the secrecy of this
 * key. The **service_role** key is the secret one — it bypasses RLS — and it must
 * never appear here or anywhere under `src/`. The local scripts read it from
 * `.env.local`, which is gitignored.
 *
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` override the committed values,
 * so a fork can point at its own project without editing this file.
 *
 * Copy both from Supabase dashboard → Project Settings → API.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fwnkhwuljwbusiwmycnc.supabase.co";
// The publishable key (the newer name for the anon key). Public by design.
const SUPABASE_ANON_KEY = "sb_publishable_jsdi0VRW3w7Qpy9VPrd6MA_6zfuKcry";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || SUPABASE_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "ClassBoard is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY in src/lib/supabase.ts " +
      "(or VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local).",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Google sign-in and email confirmation both come back as a redirect with
    // the session in the URL.
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

/** Bucket holding assignment files. Mirrors the migration. */
export const ATTACHMENTS_BUCKET = "attachments";
