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

    return (
        <>
            <div className="rail-tabs" role="tablist">
                <button
                    role="tab"
                    aria-selected={tab === "related"}
                    className="rail-tab"
                    onClick={() => setTab("related")}
                >
                    Related
                </button>
                <button
                    role="tab"
                    aria-selected={tab === "profile"}
                    className="rail-tab"
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
