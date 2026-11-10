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

/** The `profiles` row. Every account has one, created by a database trigger. */
export type UserProfile = {
  displayName: string;
};

export type AuthStatus = "loading" | "signed-out" | "signed-in";

/** What happened after an email sign-up. */
export type SignUpResult = { needsConfirmation: boolean };

type AuthValue = {
  status: AuthStatus;
  user: User | null;
  /** Null only while loading, or if the read failed. */
  profile: UserProfile | null;
  /** The name to show for the signed-in person, with sensible fallbacks. */
  displayName: string;
  /** Redirects to Google and back to `returnTo` (a path in this app). */
  signInWithGoogle: (returnTo: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
    returnTo: string,
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

type ProfileState = { userId: string; profile: UserProfile | null };

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return { displayName: typeof data.display_name === "string" ? data.display_name : "" };
}

function absolute(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  /** False until the persisted session has been restored. */
  const [isInitialized, setIsInitialized] = useState(false);
  /** Tagged with whose profile it is, so an account switch never shows the old name. */
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

  const signInWithGoogle = useCallback(async (returnTo: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: absolute(returnTo) },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string, returnTo: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Read by the database trigger that creates the profile.
          data: { display_name: name.trim() },
          emailRedirectTo: absolute(returnTo),
        },
      });
      if (error) throw error;
      return { needsConfirmation: data.session === null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!userId) return;
      const trimmed = name.trim();
      const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", userId);
      if (error) throw error;
      setProfileState({ userId, profile: { displayName: trimmed } });
    },
    [userId],
  );

  const value = useMemo<AuthValue>(() => {
    const signedIn = user !== null;
    const profileLoaded = signedIn && profileState?.userId === user.id;
    const profile = profileLoaded ? profileState.profile : null;

    return {
      status: !isInitialized ? "loading" : !signedIn ? "signed-out" : profileLoaded ? "signed-in" : "loading",
      user,
      profile,
      displayName: profile?.displayName || user?.email?.split("@")[0] || "You",
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateDisplayName,
    };
  }, [
    isInitialized,
    user,
    profileState,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateDisplayName,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
