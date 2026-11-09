import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, SIGNED_OUT_EVENT, type Admin } from "./api";

interface AuthState {
  admin: Admin | null;
  loading: boolean;
  /** Read-only accounts ("viewer") see every page but no buttons that change data. */
  canEdit: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Ends every session of this admin account, on every device. */
  signOutEverywhere: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<Admin>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });

  const forgetData = () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
  // A renewal failed (the session ended elsewhere, was revoked or expired): show the log-in.
  useEffect(() => {
    const signedOut = () => {
      queryClient.setQueryData(["me"], null);
      forgetData();
    };
    window.addEventListener(SIGNED_OUT_EVENT, signedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signedOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
  const admin = me.data ?? null;
  const value: AuthState = {
    admin,
    loading: me.isLoading,
    canEdit: admin?.role === "admin",
    async signIn(email, password) {
      const signedIn = await api<Admin>("/auth/login", { method: "POST", body: { email, password } });
      // Drop everything cached for the previous session, but keep the "me" query: the app is
      // subscribed to it, and replacing it would leave the app watching a discarded copy.
      forgetData();
      queryClient.setQueryData(["me"], signedIn);
    },
    async signOut() {
      await api("/auth/logout", { method: "POST" }).catch(() => {});
      forgetData();
      queryClient.setQueryData(["me"], null);
    },
    async signOutEverywhere() {
      await api("/auth/logout-all", { method: "POST" });
      forgetData();
      queryClient.setQueryData(["me"], null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
