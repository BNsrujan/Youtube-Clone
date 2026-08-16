import { cookies } from "next/headers";
import type {
    Video,
    Feed,
    Paginated,
    User,
    ChannelStats,
    TasteProfile,
    Comment,
} from "@/types";

/**
 * Server-side data fetching.
 *
 * This is the piece that makes Next.js worth using here rather than a plain
 * SPA. The session lives in an httpOnly cookie, so a Server Component can read
 * that cookie and call the Express API *before* the page is sent — meaning the
 * personalised feed arrives in the initial HTML instead of after a client-side
 * round trip and a spinner.
 *
 * Two rules this file exists to enforce:
 *   1. Always forward the incoming cookie, or the backend sees an anonymous
 *      request and quietly returns the cold-start feed to a signed-in user.
 *   2. Never cache. Every one of these responses is per-user.
 */

const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:8000";
const BASE = `${API_ORIGIN}/api/v1`;

export class ServerApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = "ServerApiError";
    }
}

type Query = Record<string, string | number | boolean | undefined>;

function qs(params?: Query): string {
    if (!params) return "";
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ""
    );
    if (!entries.length) return "";
    return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}`;
}

async function serverFetch<T>(path: string, params?: Query): Promise<T> {
    // In Next 15 cookies() is async — it's a dynamic API and awaiting it is
    // what opts this route out of static rendering, which is correct here.
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const res = await fetch(`${BASE}${path}${qs(params)}`, {
        headers: cookieHeader ? { cookie: cookieHeader } : {},
        // Personalised, per-request data. Caching it would serve one user's
        // feed to another.
        cache: "no-store",
    });

    let payload: { data?: T; message?: string } | null = null;
    try {
        payload = await res.json();
    } catch {
        // Non-JSON (backend down, proxy error page).
    }

    if (!res.ok) {
        throw new ServerApiError(
            res.status,
            payload?.message || `Request failed (${res.status})`
        );
    }

    return (payload?.data ?? payload) as T;
}

/**
 * Wrapper for data a page can render without.
 * A failed related-videos call should not blank the whole watch page.
 */
export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
    try {
        return await promise;
    } catch {
        return fallback;
    }
}

export const serverApi = {
    me: () => serverFetch<User>("/users/current-user"),
    channel: (username: string) => serverFetch<User>(`/users/c/${username}`),

    feed: (params?: Query) => serverFetch<Feed>("/recommendations/feed", params),
    related: (videoId: string, params?: Query) =>
        serverFetch<Video[]>(`/recommendations/related/${videoId}`, params),
    trending: (params?: Query) => serverFetch<Video[]>("/recommendations/trending", params),
    tasteProfile: () => serverFetch<TasteProfile>("/recommendations/profile"),

    video: (id: string) => serverFetch<Video>(`/videos/${id}`),
    videos: (params?: Query) => serverFetch<Paginated<Video>>("/videos", params),

    comments: (videoId: string, params?: Query) =>
        serverFetch<Paginated<Comment>>(`/comments/${videoId}`, params),

    continueWatching: () => serverFetch<Video[]>("/stream/continue-watching"),

    stats: () => serverFetch<ChannelStats>("/dashboard/stats"),
    myVideos: (params?: Query) => serverFetch<Paginated<Video>>("/dashboard/videos", params),
};

/** True when a session cookie is present. Cheap gate for protected pages. */
export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    return Boolean(cookieStore.get("accessToken") || cookieStore.get("refreshToken"));
}

/** The signed-in user, or null. Never throws — callers render either way. */
export async function getCurrentUser(): Promise<User | null> {
    if (!(await isAuthenticated())) return null;
    try {
        return await serverApi.me();
    } catch {
        return null;
    }
}
