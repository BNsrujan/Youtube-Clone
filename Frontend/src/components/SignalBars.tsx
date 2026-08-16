import { SIGNAL_COLORS, SIGNAL_LABELS, SOURCE_COLORS, SOURCE_LABELS } from "@/lib/format";
import { sigrow, sigrowK, sigbar, sigbarFill, sigrowV } from "@/lib/ui";
import type { RecommendationBreakdown, CandidateSource } from "@/types";

/**
 * The score breakdown.
 *
 * This is the interface answering "why am I seeing this" with real numbers
 * instead of a reassurance. A recommender you can't interrogate is one you
 * can't debug — and, for a viewer, one you can't trust.
 *
 * A Server Component: no interactivity, so it costs zero client JS.
 */
export function SignalBreakdown({
    breakdown,
    total,
}: {
    breakdown?: RecommendationBreakdown;
    total?: number;
}) {
    if (!breakdown) return null;

    const rows = Object.entries(breakdown)
        .filter(([, v]) => typeof v === "number" && v > 0)
        .sort((a, b) => (b[1] as number) - (a[1] as number)) as [string, number][];

    if (!rows.length) {
        return (
            <p className="text-text-faint text-[13px] mt-2 mb-0">
                No personalised signals fired — this came from trending.
            </p>
        );
    }

    const max = Math.max(...rows.map(([, v]) => v));

    return (
        <div>
            {rows.map(([key, value]) => (
                <div className={sigrow} key={key}>
                    <span className={sigrowK}>{SIGNAL_LABELS[key] ?? key}</span>
                    <div className={sigbar}>
                        <span
                            className={sigbarFill}
                            style={{
                                width: `${(value / max) * 100}%`,
                                background: SIGNAL_COLORS[key] ?? "var(--sig-diversity)",
                            }}
                        />
                    </div>
                    <span className={sigrowV}>{value.toFixed(3)}</span>
                </div>
            ))}

            {total !== undefined && (
                <div
                    className={sigrow + " border-t border-line mt-1.5"}
                    style={{ paddingTop: 8 }}
                >
                    <span className={sigrowK} style={{ color: "var(--text)" }}>total</span>
                    <span />
                    <span className={sigrowV} style={{ color: "var(--text)" }}>
                        {total.toFixed(3)}
                    </span>
                </div>
            )}
        </div>
    );
}

/** Compact source pips on every card — same palette as the breakdown bars. */
export function SourcePips({ sources = [] }: { sources?: CandidateSource[] }) {
    const unique = [...new Set(sources)].filter((s) => s !== "explain");
    if (!unique.length) return null;

    return (
        <div
            className="flex items-center gap-1 mt-[7px]"
            title={unique.map((s) => SOURCE_LABELS[s] ?? s).join(" · ")}
        >
            {unique.slice(0, 4).map((s) => (
                <span
                    key={s}
                    className="w-4 h-[3px] rounded-[2px]"
                    style={{ background: SOURCE_COLORS[s] ?? "var(--line-bright)" }}
                />
            ))}
            <span className="font-mono text-[10px] text-text-faint tracking-[0.04em] ml-[3px]">
                {SOURCE_LABELS[unique[0]] ?? unique[0]}
            </span>
        </div>
    );
}
