"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

/**
 * Toggles the feed's `explain` flag.
 *
 * State lives in the URL rather than component state, so the server re-renders
 * the feed with breakdowns attached — and the setting survives a reload or a
 * shared link. useTransition keeps the current feed on screen while the new
 * one streams, instead of blanking to a skeleton.
 */
export default function ScoringToggle() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const [pending, startTransition] = useTransition();

    const on = params.get("explain") === "true";

    const toggle = () => {
        const next = new URLSearchParams(params.toString());
        if (on) next.delete("explain");
        else next.set("explain", "true");

        startTransition(() => {
            router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
        });
    };

    return (
        <button
            className={`btn${on ? " btn-on" : ""}`}
            style={{ marginLeft: "auto", fontSize: 12, padding: "5px 11px" }}
            onClick={toggle}
            aria-pressed={on}
            disabled={pending}
        >
            {pending ? "Loading" : on ? "Hide scoring" : "Show scoring"}
        </button>
    );
}
