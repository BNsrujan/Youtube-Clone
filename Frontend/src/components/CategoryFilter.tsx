"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { chip, chipOn, chipRow } from "@/lib/ui";

const CATEGORIES = [
    "", "education", "music", "gaming", "news", "sports",
    "tech", "comedy", "film", "howto", "travel", "other",
];

const LABELS: Record<string, string> = {
    "": "All",
    education: "Education",
    music: "Music",
    gaming: "Gaming",
    news: "News",
    sports: "Sport",
    tech: "Tech",
    comedy: "Comedy",
    film: "Film",
    howto: "How-to",
    travel: "Travel",
    other: "Other",
};

/**
 * The category chip bar. Same URL-as-state approach as ScoringToggle: the
 * selection lives in the query string, so the server re-renders the grid and
 * a shared link keeps the filter.
 *
 * It was a <select>; it's a scrolling pill row now, which is the same one
 * router.push under different markup. The destination stays /trending — that's
 * the route this app filters by category — so the bar is live on the home feed
 * too, where "All" is the personalised slate and any other chip is a jump into
 * that category.
 */
export default function CategoryFilter() {
    const router = useRouter();
    const params = useSearchParams();
    const pathname = usePathname();
    const [pending, startTransition] = useTransition();
    const current = params.get("category") ?? "";

    const go = (value: string) => {
        const next = new URLSearchParams(params.toString());
        if (value) next.set("category", value);
        else next.delete("category");
        // "All" on the home feed means the personalised slate, not trending's
        // unfiltered list — everywhere else it's /trending with no category.
        const base = value || pathname !== "/" ? "/trending" : "/";
        startTransition(() => router.push(`${base}${next.toString() ? `?${next}` : ""}`));
    };

    return (
        <div
            className={chipRow}
            role="tablist"
            aria-label="Filter by category"
            aria-busy={pending}
        >
            {CATEGORIES.map((c) => {
                const on = c === current;
                return (
                    <button
                        key={c}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        disabled={pending}
                        onClick={() => go(c)}
                        className={on ? chipOn : chip}
                    >
                        {LABELS[c] ?? c}
                    </button>
                );
            })}
        </div>
    );
}
