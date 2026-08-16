import type { CandidateSource } from "@/types";

/** Display formatting. Shared by server and client components — no "use client". */

export function duration(seconds = 0): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
        : `${m}:${String(sec).padStart(2, "0")}`;
}

export function count(n = 0): string {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
    return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * Relative time.
 *
 * Deliberately coarse (whole units only). A server-rendered "3m ago" that
 * hydrates a few seconds later must not disagree with the client, or React
 * reports a hydration mismatch — coarse buckets make that vanishingly rare.
 */
export function ago(date?: string): string {
    if (!date) return "";
    const secs = (Date.now() - new Date(date).getTime()) / 1000;
    const steps: [number, string][] = [
        [31536000, "y"], [2592000, "mo"], [604800, "w"],
        [86400, "d"], [3600, "h"], [60, "m"],
    ];
    for (const [size, label] of steps) {
        if (secs >= size) return `${Math.floor(secs / size)}${label} ago`;
    }
    return "just now";
}

export function bitrate(bps = 0): string {
    if (!bps) return "—";
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
    return `${Math.round(bps / 1000)} kbps`;
}

/** Fixed hue per ranker signal — the same colour everywhere it appears. */
export const SIGNAL_COLORS: Record<string, string> = {
    content: "var(--sig-content)",
    collaborative: "var(--sig-collab)",
    engagement: "var(--sig-engagement)",
    freshness: "var(--sig-freshness)",
    subscription: "var(--sig-subscription)",
    creatorAffinity: "var(--sig-creator)",
    diversityBonus: "var(--sig-diversity)",
};

export const SIGNAL_LABELS: Record<string, string> = {
    content: "your tags",
    collaborative: "co-watch",
    engagement: "engagement",
    freshness: "freshness",
    subscription: "subscribed",
    creatorAffinity: "creator",
    diversityBonus: "multi-source",
};

/** Candidate sources share the score signals' vocabulary. */
export const SOURCE_COLORS: Record<CandidateSource | string, string> = {
    collaborative: "var(--sig-collab)",
    content: "var(--sig-content)",
    subscription: "var(--sig-subscription)",
    trending: "var(--sig-freshness)",
    exploration: "var(--sig-engagement)",
    same_creator: "var(--sig-creator)",
    hybrid: "var(--sig-content)",
};

export const SOURCE_LABELS: Record<CandidateSource | string, string> = {
    collaborative: "co-watch",
    content: "your tags",
    subscription: "subscribed",
    trending: "trending",
    exploration: "new to you",
    same_creator: "same creator",
    hybrid: "co-watch + tags",
};
