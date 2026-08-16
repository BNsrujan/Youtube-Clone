"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const CATEGORIES = [
    "", "education", "music", "gaming", "news", "sports",
    "tech", "comedy", "film", "howto", "travel", "other",
];

/** Trending category filter. Same URL-as-state approach as ScoringToggle. */
export default function CategoryFilter() {
    const router = useRouter();
    const params = useSearchParams();
    const [pending, startTransition] = useTransition();
    const current = params.get("category") ?? "";

    return (
        <select
            value={current}
            disabled={pending}
            aria-label="Filter by category"
            onChange={(e) => {
                const next = new URLSearchParams(params.toString());
                if (e.target.value) next.set("category", e.target.value);
                else next.delete("category");
                startTransition(() => router.push(`/trending${next.toString() ? `?${next}` : ""}`));
            }}
            style={{
                marginLeft: "auto",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 13,
            }}
        >
            {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c || "All categories"}</option>
            ))}
        </select>
    );
}
