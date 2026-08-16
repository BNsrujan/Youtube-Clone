"use client";

import { useState, type ReactNode } from "react";

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

    const railTab =
        "bg-transparent border-0 border-b-2 border-transparent px-3 py-2 cursor-pointer font-mono text-[10.5px] tracking-[0.13em] uppercase text-text-faint aria-selected:text-text aria-selected:border-b-live";

    return (
        <>
            <div className="flex gap-0.5 border-b border-line mb-3.5" role="tablist">
                <button
                    role="tab"
                    aria-selected={tab === "related"}
                    className={railTab}
                    onClick={() => setTab("related")}
                >
                    Related
                </button>
                <button
                    role="tab"
                    aria-selected={tab === "profile"}
                    className={railTab}
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
