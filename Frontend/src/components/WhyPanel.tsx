"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { SignalBreakdown } from "./SignalBars";
import { eyebrow, skeleton, skLine, tag, infoBox } from "@/lib/ui";
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
        <div className={infoBox + " mt-3 p-0 overflow-hidden"}>
            <button
                className="flex items-center justify-between w-full bg-transparent border-none px-3 py-3 cursor-pointer text-left transition-colors duration-100 hover:bg-surface-3"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
            >
                <span className="text-[13px] font-medium text-text">Why you&apos;re seeing this</span>
                <span className="text-[13px] font-medium text-text-dim">
                    {open ? "Show less" : "...more"}
                </span>
            </button>

            {open && (
                <div className="px-3 pt-1 pb-4 border-t border-line">
                    {error ? (
                        <p className="text-[13px] text-text-dim mt-2 mb-0">
                            Scoring unavailable: {error}
                        </p>
                    ) : !data ? (
                        <div className={skeleton + " " + skLine} style={{ marginTop: 12 }} />
                    ) : (
                        <>
                            <SignalBreakdown breakdown={data.breakdown} total={data.score} />
                            {data.matchedTags?.length > 0 && (
                                <>
                                    <p className={eyebrow + " mt-3.5"}>
                                        Matched against your profile
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {data.matchedTags.map((t) => (
                                            <span key={t} className={tag}>#{t}</span>
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
