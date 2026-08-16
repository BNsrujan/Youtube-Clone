"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { SignalBreakdown } from "./SignalBars";
import type { WhyExplanation } from "@/types";

/**
 * "Why you're seeing this" — the full per-signal breakdown for this video.
 *
 * Fetched lazily on expand rather than with the page: most viewers won't open
 * it, and scoring one video costs the backend a rank pass.
 */
export default function WhyPanel({ videoId }: { videoId: string }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<WhyExplanation | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setData(null);
        setError(null);
        setOpen(false);
    }, [videoId]);

    useEffect(() => {
        if (!open || data) return;
        let cancelled = false;
        api.why(videoId)
            .then((d) => !cancelled && setData(d))
            .catch((e: Error) => !cancelled && setError(e.message));
        return () => {
            cancelled = true;
        };
    }, [open, videoId, data]);

    return (
        <div className="why">
            <button className="why-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                <span className="eyebrow">Why you&apos;re seeing this</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                    {open ? "hide −" : "show +"}
                </span>
            </button>

            {open && (
                <div className="why-body">
                    {error ? (
                        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "8px 0 0" }}>
                            Scoring unavailable: {error}
                        </p>
                    ) : !data ? (
                        <div className="skeleton sk-line" style={{ marginTop: 12 }} />
                    ) : (
                        <>
                            <SignalBreakdown breakdown={data.breakdown} total={data.score} />
                            {data.matchedTags?.length > 0 && (
                                <>
                                    <p className="eyebrow" style={{ marginTop: 14 }}>
                                        Matched against your profile
                                    </p>
                                    <div className="tags">
                                        {data.matchedTags.map((t) => (
                                            <span key={t} className="tag">#{t}</span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
