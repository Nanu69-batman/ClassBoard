import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

/** The `profiles` row. The only authority on what a person may do. */
export type UserProfile = {
  role: "cr" | "superadmin";
  classId?: string;
  active: boolean;
  displayName?: string;
  email?: string;
};

export type AuthStatus = "loading" | "signed-out" | "signed-in";

/** What happened after an email sign-up. */
export type SignUpResult = { needsConfirmation: boolean };

type AuthValue = {
  status: AuthStatus;
  /** The Supabase identity, or null. */
  user: User | null;
  /** The `profiles` row, or null when there is none. */
  profile: UserProfile | null;
  /**
   * True when signed in but holding no role at all — a self-registered account,
   * or a CR who has not claimed an invite yet. Such a person can read the
   * public feed and nothing else.
   */
  hasNoRole: boolean;
  isCr: boolean;
  isSuperadmin: boolean;
  /** Redirects to Google and back to the current page. */
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccountWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  /** Re-reads the profile, e.g. right after claiming an invite. */
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

type ProfileState = { userId: string; profile: UserProfile | null };

function toProfile(row: Record<string, unknown>): UserProfile | null {
  if (row.role !== "cr" && row.role !== "superadmin") return null;
  return {
    role: row.role,
    classId: typeof row.class_id === "string" ? row.class_id : undefined,
    active: row.active === true,
    displayName: typeof row.display_name === "string" ? row.display_name : undefined,
    email: typeof row.email === "string" ? row.email : undefined,
  };
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, class_id, active, display_name, email")
    .eq("id", userId)
    .maybeSingle();

  // A read failure must not invent a role. Null makes every guard deny, which is
  // the safe direction.
  if (error || !data) return null;
  return toProfile(data);
}

/** Where to come back to after a redirect: this exact page, query included. */
function currentUrl(): string {
  return window.location.href;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  /**
   * False until the persisted session has been restored. Reporting "signed-out"
   * before then would bounce a signed-in person to the login page, and because
   * each route mounts its own provider that becomes a redirect loop.
   */
  const [isInitialized, setIsInitialized] = useState(false);
  /**
   * The profile, tagged with whose it is. A profile is only trusted while its
   * userId matches the current user, so a sign-in or account switch can never
   * briefly show the previous person's role — or "no role" before the new one
   * has loaded.
   */
  const [profileState, setProfileState] = useState<ProfileState | null>(null);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      setIsInitialized(true);
    });

    // Supabase warns against awaiting its own calls inside this callback, so it
    // only records the user; the profile loads in the effect below.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsInitialized(true);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id ?? null;

  const loadProfile = useCallback(async (id: string) => {
    // Tagged with the id it was fetched for; the value below ignores it if the
    // signed-in user has changed in the meantime.
    const profile = await fetchProfile(id);
    setProfileState({ userId: id, profile });
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfileState(null);
      return;
    }

    let cancelled = false;
    void fetchProfile(userId).then((profile) => {
      if (!cancelled) setProfileState({ userId, profile });
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: currentUrl() },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const createAccountWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // The confirmation email links back to this page — for the invite page,
      // that keeps the token in the URL.
      options: { emailRedirectTo: currentUrl() },
    });
    if (error) throw error;
    return { needsConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const value = useMemo<AuthValue>(() => {
    const signedIn = user !== null;
    const profileLoaded = signedIn && profileState?.userId === user.id;
    const profile = profileLoaded ? profileState.profile : null;

    return {
      status: !isInitialized
        ? "loading"
        : !signedIn
          ? "signed-out"
          : profileLoaded
            ? "signed-in"
            : "loading",
      user,
      profile,
      hasNoRole: profileLoaded && profile === null,
      isCr: profile?.role === "cr" && profile.active,
      isSuperadmin: profile?.role === "superadmin" && profile.active,
      signInWithGoogle,
      signInWithEmail,
      createAccountWithEmail,
      signOut,
      refreshProfile,
    };
  }, [
    isInitialized,
    user,
    profileState,
    signInWithGoogle,
    signInWithEmail,
    createAccountWithEmail,
    signOut,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
