"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { TasteProfile } from "@/types";

/**
 * The user's learned taste profile, with a reset.
 *
 * Initial data comes from the server; this component only exists as a client
 * one so the reset button works. A recommender that has drawn the wrong
 * conclusions about someone and offers no way to correct it is a design
 * failure, not just a missing feature.
 */
export default function TasteProfilePanel({ profile }: { profile: TasteProfile | null }) {
    const router = useRouter();
    const [data, setData] = useState(profile);
    const [busy, setBusy] = useState(false);

    if (!data) {
        return (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
                Sign in to see what the recommender has learned about you.
            </p>
        );
    }

    const reset = async () => {
        setBusy(true);
        try {
            await api.resetProfile();
            setData({ ...data, topTags: [], topCategories: [], diversityScore: 0, interactionCount: 0 });
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    const tags = data.topTags ?? [];
    const max = Math.max(...tags.map((t) => t.weight), 1);

    return (
        <div>
            <p className="eyebrow">Learned from what you finish, not what you click</p>

            {tags.length === 0 ? (
                <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 12 }}>
                    Nothing learned yet. Watch a few videos past 30% and this fills in.
                </p>
            ) : (
                <div style={{ marginTop: 12 }}>
                    {tags.slice(0, 12).map((t) => (
                        <div className="sigrow" key={t.key}>
                            <span className="sigrow-k">{t.key}</span>
                            <div className="sigbar">
                                <span
                                    style={{
                                        width: `${(t.weight / max) * 100}%`,
                                        background: "var(--sig-content)",
                                    }}
                                />
                            </div>
                            <span className="sigrow-v">{t.weight.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div
                style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                }}
            >
                <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                    diversity {data.diversityScore.toFixed(2)} · {data.interactionCount} signals
                </span>
                <button
                    className="btn"
                    style={{ marginLeft: "auto", fontSize: 12 }}
                    onClick={reset}
                    disabled={busy}
                >
                    {busy ? "Resetting" : "Reset profile"}
                </button>
            </div>
        </div>
    );
}
