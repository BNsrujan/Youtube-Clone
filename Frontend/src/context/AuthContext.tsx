"use client";

import {
    createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, setUnauthorizedHandler } from "@/lib/api-client";
import type { User } from "@/types";

interface AuthValue {
    user: User | null;
    login: (credentials: { username: string; password: string }) => Promise<User>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Session state.
 *
 * Seeded from the server (`initialUser`) rather than fetched on mount, so
 * there's no "am I logged in?" round trip and no flash of signed-out UI.
 * After that it only changes through explicit login/logout.
 */
export function AuthProvider({
    children,
    initialUser,
}: {
    children: ReactNode;
    initialUser: User | null;
}) {
    const [user, setUser] = useState<User | null>(initialUser);
    const router = useRouter();

    // Keep in step when a server navigation returns a different session.
    useEffect(() => {
        setUser(initialUser);
    }, [initialUser]);

    useEffect(() => {
        setUnauthorizedHandler(() => setUser(null));
    }, []);

    const login = useCallback(
        async (credentials: { username: string; password: string }) => {
            const data = await api.login(credentials);
            setUser(data.user);
            // Server Components cached this request's data as anonymous —
            // refresh so they re-run and pick up the new cookie.
            router.refresh();
            return data.user;
        },
        [router]
    );

    const logout = useCallback(async () => {
        try {
            await api.logout();
        } finally {
            setUser(null);
            router.refresh();
            router.push("/");
        }
    }, [router]);

    const refresh = useCallback(async () => {
        try {
            setUser(await api.me());
        } catch {
            setUser(null);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
