"use client";

import { useState, type ReactNode } from "react";

import { chip, chipOn, chipRow } from "@/lib/ui";

/** Tab shell for the watch-page sidebar. Both panels render server-side; this
 *  only decides which is visible, so neither pays a fetch on switch. */
export default function RailTabs({
    related,
    profile,
}: {
    related: ReactNode;
    profile: ReactNode;
}) {
    const [tab, setTab] = useState<"related" | "profile">("related");

    return (
        <>
            {/* Chips rather than underlined tabs — the rail's header on
                YouTube is the same pill row the home feed uses. */}
            <div className={chipRow + " pt-0 pb-3"} role="tablist">
                <button
                    role="tab"
                    aria-selected={tab === "related"}
                    className={tab === "related" ? chipOn : chip}
                    onClick={() => setTab("related")}
                >
                    Related
                </button>
                <button
                    role="tab"
                    aria-selected={tab === "profile"}
                    className={tab === "profile" ? chipOn : chip}
                    onClick={() => setTab("profile")}
                >
                    Your profile
                </button>
            </div>

            <div hidden={tab !== "related"}>{related}</div>
            <div hidden={tab !== "profile"}>{profile}</div>
        </>
    );
}
