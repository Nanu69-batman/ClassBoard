/**
 * Claiming a CR invite.
 *
 * This is the only place in the app where a role can be granted. `/cr/login`
 * has no registration option, so the ability to register is itself gated behind
 * a valid token.
 *
 * Both calls are database functions (see the migration). The invite table is
 * unreadable to everyone but a superadmin:
 *
 *  - `peek_invite` answers "which class would this token grant?" so the page can
 *    say so before anyone makes an account.
 *  - `claim_invite` spends the token and creates the profile in one
 *    transaction, with the role hard-coded to `cr` and the class taken from the
 *    invite row. A failure leaves the token unspent, so the CR can simply retry.
 */

import { supabase } from "../lib/supabase";

/** Why a claim did not go through. */
export type InviteFailure = "invite-invalid" | "already-has-role" | "invalid-name" | "unknown";

export type ClaimOutcome = { ok: true; classId: string } | { ok: false; reason: InviteFailure };

const KNOWN_FAILURES: InviteFailure[] = ["invite-invalid", "already-has-role", "invalid-name"];

/** An invite token, as read from the link. Never trusted beyond its shape. */
export function readInviteToken(): string | null {
  const raw = new URLSearchParams(window.location.search).get("invite");
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(trimmed) ? trimmed : null;
}

/** The display name of the class this token grants, or null if it is not usable. */
export async function peekInvite(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("peek_invite", { p_token: token });
  if (error) {
    console.error("[classboard] invite check failed", error);
    return null;
  }
  return typeof data === "string" && data ? data : null;
}

/** Spends the invite and creates the caller's CR profile, atomically. */
export async function claimInvite(token: string, displayName: string): Promise<ClaimOutcome> {
  const { data, error } = await supabase.rpc("claim_invite", {
    p_token: token,
    p_display_name: displayName.trim(),
  });

  if (error) {
    const reason = KNOWN_FAILURES.find((each) => error.message.includes(each)) ?? "unknown";
    if (reason === "unknown") console.error("[classboard] claim failed", error);
    return { ok: false, reason };
  }

  return { ok: true, classId: typeof data === "string" ? data : "" };
}
