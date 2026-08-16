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
            className="ml-auto bg-surface-2 border border-line rounded-md px-2.5 py-1.5 text-[13px]"
        >
            {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c || "All categories"}</option>
            ))}
        </select>
    );
}
