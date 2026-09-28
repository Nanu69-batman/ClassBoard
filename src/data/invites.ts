/**
 * Claiming a CR invite.
 *
 * This is the only place in the app where an account can be created, and it is
 * the only path that can grant a role. `/cr/login` deliberately has no
 * registration option, so typing `/cr` in a URL can never make an account. The
 * ability to register is therefore itself gated behind a valid token.
 *
 * ## Why the class id travels in the URL
 *
 * `crInvites/{token}` is unreadable by anyone, including the claimant — the
 * rules say `allow get, list: if false`. That is deliberate: a token is a bearer
 * credential, so it is spent by writing against it rather than by being read and
 * checked. It also means tokens cannot be probed or enumerated.
 *
 * The side effect is that the client cannot read the class id out of the invite
 * before claiming it, so the link carries it: `?invite=<token>&class=<classId>`.
 * That is not a trust decision. The rules compare the submitted classId against
 * the invite's own `classId` and refuse a mismatch, so a tampered or stale link
 * fails rather than granting the wrong class.
 *
 * ## Order of the two writes, and why it is not a batch
 *
 * The invite must be marked used *before* the profile is created, because the
 * profile rule requires `presentedInvite().usedBy == request.auth.uid` — the
 * consumed invite is the proof of claim. It cannot be a single batch, because
 * rules evaluate `get()` against committed state, not against the other writes
 * in the same batch.
 *
 * The cost is that a failure on the second write leaves the invite spent. That is
 * why `preflightClaim` checks the class is real and active first: a mismatch
 * there is the realistic failure, and catching it before spending the token is the
 * difference between "try again" and "ask for a new link".
 */

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import type { ClassInfo } from "./types";

/** Why a claim did not go through. Deliberately coarse — see OUTCOME_MESSAGES. */
export type InviteFailure = "invite-invalid" | "already-has-role" | "unknown";

export type ClaimOutcome = { ok: true } | { ok: false; reason: InviteFailure };

/** An invite token, as read from the link. Never trusted beyond its shape. */
export function readInviteToken(): string | null {
  const raw = new URLSearchParams(window.location.search).get("invite");
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  // Firestore document ids are 1-1500 characters and cannot contain `/`.
  if (!trimmed || trimmed.length > 1500) return null;
  if (/[/.]/.test(trimmed)) return null;
  if (/[\u0000-\u001f]/.test(trimmed)) return null;

  return trimmed;
}

/** The class the link names. Same validation as every other id from the URL. */
export function readInviteClassId(): string | null {
  const raw = new URLSearchParams(window.location.search).get("class");
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 1500) return null;
  if (/[/.]/.test(trimmed)) return null;
  if (/[\u0000-\u001f]/.test(trimmed)) return null;

  return trimmed;
}

/**
 * The class the invite names, if it is still real and active.
 *
 * Reading the class is the one pre-flight check available, because classes are
 * public and only invites are not. It catches the realistic failure — a link
 * whose class has been deactivated — before the token is spent.
 */
export async function preflightClaim(classId: string): Promise<ClassInfo | null> {
  try {
    const snapshot = await getDoc(doc(db, `classes/${classId}`));
    if (!snapshot.exists() || snapshot.data().active !== true) return null;

    const data = snapshot.data();
    return {
      id: classId,
      name: typeof data.name === "string" ? data.name : "",
      batch: typeof data.batch === "string" ? data.batch : "",
      section: typeof data.section === "string" ? data.section : "",
      displayName:
        typeof data.displayName === "string" && data.displayName ? data.displayName : classId,
      active: true,
    };
  } catch {
    return null;
  }
}

/**
 * The name that will appear on everything this CR posts.
 *
 * Never a placeholder. A Google sign-in always has a verified name, but an
 * email/password account may have none at all, and "Your CR" written to a
 * student-visible `postedByName` is worse than no name: it looks deliberate and
 * tells a class nothing about who set the work.
 *
 * The local part of the email is the last resort, because it is at least true of
 * the person and is editable later from the CR's own Account section.
 */
export function resolveAuthorName(user: {
  displayName?: string | null;
  email?: string | null;
} | null): string {
  const fromAuth = user?.displayName?.trim();
  if (fromAuth) return fromAuth;

  const local = user?.email?.split("@")[0]?.trim();
  if (local) return local;

  return "Class representative";
}

/**
 * Spends the invite and writes the CR profile.
 *
 * `displayName` and `email` come from the Firebase Auth record, never from a form
 * field, so a student-visible `postedByName` can only ever be tied to a verified
 * identity and never a name someone typed into a text box.
 */
export async function claimInvite(
  token: string,
  classId: string,
  user: { uid: string; displayName: string | null; email: string | null },
): Promise<ClaimOutcome> {
  // A profile that already exists means this account is already a CR or a
  // superadmin. Refusing here rather than letting the write fail keeps the
  // failure explainable, and stops an active CR burning a token to find out.
  const existing = await getDoc(doc(db, "users", user.uid));
  if (existing.exists()) return { ok: false, reason: "already-has-role" };

  // Step one: consume the token. This is the write the rules actually authorise
  // against the token, and it is what makes the claimant's uid the proof of claim.
  try {
    await updateDoc(doc(db, `crInvites/${token}`), {
      used: true,
      usedBy: user.uid,
    });
  } catch {
    // Unused, expired, already spent, or no such token. The rules refuse all four
    // identically, and deliberately so: a distinguishable error would turn this
    // into an oracle for guessing which tokens exist.
    return { ok: false, reason: "invite-invalid" };
  }

  // Step two: create the profile. The rules pin role to 'cr' here, so no
  // combination of token, URL or request body can mint a superadmin.
  try {
    await setDoc(doc(db, "users", user.uid), {
      role: "cr",
      classId,
      active: true,
      displayName: user.displayName,
      email: user.email,
      inviteToken: token,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // The token is already spent. Treated as unknown rather than a specific
    // reason, because the honest message is "ask for a new link", not a diagnosis
    // the claimant cannot act on.
    return { ok: false, reason: "unknown" };
  }

  return { ok: true };
}
