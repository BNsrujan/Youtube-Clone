"use client";

import type {
    User, Video, Feed, Paginated, Comment, PlaybackManifest,
    WhyExplanation, TasteProfile, ChannelStats,
} from "@/types";

/**
 * Browser-side API client.
 *
 * Handles mutations and anything that has to happen after hydration —
 * likes, subscriptions, comments, watch heartbeats. Reads that can happen
 * before paint live in api-server.ts instead.
 *
 * Requests go to the relative /api path, which next.config.mjs rewrites to
 * the Express backend, so the cookie is same-origin and rides along
 * automatically.
 */

const BASE = "/api/v1";

export class ApiError extends Error {
    status: number;
    errors?: string[];
    constructor(status: number, message: string, errors?: string[]) {
        super(message);
        this.status = status;
        this.errors = errors;
        this.name = "ApiError";
    }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
    onUnauthorized = fn;
};

/** One shared refresh promise, so N parallel 401s trigger one refresh. */
let refreshing: Promise<Response> | null = null;

interface RequestOptions {
    method?: string;
    body?: unknown;
    isForm?: boolean;
    retry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, isForm = false, retry = true } = options;

    const init: RequestInit = { method, credentials: "include", headers: {} };

    if (body !== undefined) {
        if (isForm) {
            // Never set Content-Type on FormData — the browser must supply the
            // multipart boundary itself.
            init.body = body as FormData;
        } else {
            init.headers = { "Content-Type": "application/json" };
            init.body = JSON.stringify(body);
        }
    }

    const res = await fetch(`${BASE}${path}`, init);

    // An expired access token is recoverable: refresh once, then replay.
    if (res.status === 401 && retry && !path.includes("/users/login")) {
        if (!refreshing) {
            refreshing = fetch(`${BASE}/users/refresh-token`, {
                method: "POST",
                credentials: "include",
            }).finally(() => {
                refreshing = null;
            });
        }
        const refreshed = await refreshing;
        if (refreshed.ok) {
            return request<T>(path, { ...options, retry: false });
        }
        onUnauthorized?.();
    }

    let payload: { data?: T; message?: string; errors?: string[] } | null = null;
    try {
        payload = await res.json();
    } catch {
        /* non-JSON response */
    }

    if (!res.ok) {
        throw new ApiError(
            res.status,
            payload?.message || `Request failed (${res.status})`,
            payload?.errors
        );
    }

    return (payload?.data ?? payload) as T;
}

type Query = Record<string, string | number | boolean | undefined>;

const qs = (params?: Query): string => {
    if (!params) return "";
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ""
    );
    return entries.length
        ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}`
        : "";
};

export const api = {
    // auth
    register: (form: FormData) =>
        request<User>("/users/register", { method: "POST", body: form, isForm: true }),
    login: (body: { username?: string; email?: string; password: string }) =>
        request<{ user: User; accessToken: string }>("/users/login", { method: "POST", body }),
    logout: () => request<Record<string, never>>("/users/logout", { method: "POST" }),
    me: () => request<User>("/users/current-user"),

    // videos
    video: (id: string) => request<Video>(`/videos/${id}`),
    videos: (params?: Query) => request<Paginated<Video>>(`/videos${qs(params)}`),
    publish: (form: FormData) =>
        request<Video>("/videos", { method: "POST", body: form, isForm: true }),
    deleteVideo: (id: string) => request<{ _id: string }>(`/videos/${id}`, { method: "DELETE" }),
    togglePublish: (id: string) =>
        request<{ _id: string; isPublished: boolean }>(`/videos/toggle/publish/${id}`, {
            method: "PATCH",
        }),

    // streaming
    manifest: (id: string) => request<PlaybackManifest>(`/stream/${id}/manifest`),
    progress: (
        id: string,
        body: { positionSeconds: number; watchedSeconds: number; source?: string; rankPosition?: number }
    ) => request<{ watchRatio: number; countedAsView: boolean }>(`/stream/${id}/progress`, {
        method: "POST",
        body,
    }),
    continueWatching: () => request<Video[]>("/stream/continue-watching"),

    // recommendations
    feed: (params?: Query) => request<Feed>(`/recommendations/feed${qs(params)}`),
    related: (id: string, params?: Query) =>
        request<Video[]>(`/recommendations/related/${id}${qs(params)}`),
    why: (id: string) => request<WhyExplanation>(`/recommendations/why/${id}`),
    tasteProfile: () => request<TasteProfile>("/recommendations/profile"),
    resetProfile: () => request<Record<string, never>>("/recommendations/profile", { method: "DELETE" }),
    rebuildProfile: () =>
        request<{ interactionCount: number }>("/recommendations/rebuild", { method: "POST" }),

    // social
    comments: (videoId: string, params?: Query) =>
        request<Paginated<Comment>>(`/comments/${videoId}${qs(params)}`),
    addComment: (videoId: string, content: string) =>
        request<Comment>(`/comments/${videoId}`, { method: "POST", body: { content } }),
    deleteComment: (id: string) =>
        request<{ _id: string }>(`/comments/c/${id}`, { method: "DELETE" }),
    likeVideo: (id: string) => request<{ liked: boolean }>(`/likes/toggle/v/${id}`, { method: "POST" }),
    subscribe: (channelId: string) =>
        request<{ subscribed: boolean }>(`/subscriptions/toggle/${channelId}`, { method: "POST" }),

    // studio
    stats: () => request<ChannelStats>("/dashboard/stats"),
    myVideos: (params?: Query) => request<Paginated<Video>>(`/dashboard/videos${qs(params)}`),
};
