import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { serverApi, safe, isAuthenticated } from "@/lib/api-server";
import Empty from "@/components/Empty";
import { count, duration, ago } from "@/lib/format";
import {
    feedHead,
    hDisplay,
    eyebrow,
    skeleton,
    statGrid,
    stat,
    statV,
    table,
    tableTh,
    tableTd,
    tableTdNum,
    mono,
} from "@/lib/ui";
import type { ChannelStats, Paginated, Video } from "@/types";

export const metadata: Metadata = { title: "Studio · videotube" };
export const dynamic = "force-dynamic";

/**
 * Creator analytics — entirely server-rendered, zero client JS.
 * Retention leads over raw views deliberately: it's the number the ranker
 * actually weighs.
 */
export default async function StudioPage() {
    if (!(await isAuthenticated())) redirect("/login");

    return (
        <>
            <div className={feedHead}>
                <h1 className={hDisplay + " text-xl"}>Studio</h1>
                <span className={eyebrow}>your channel</span>
            </div>

            <Suspense fallback={<StatsSkeleton />}>
                <Overview />
            </Suspense>

            <Suspense fallback={<div className={skeleton + " h-[120px] mt-5"} />}>
                <VideoTable />
            </Suspense>
        </>
    );
}

async function Overview() {
    const stats = await safe<ChannelStats | null>(serverApi.stats(), null);
    if (!stats) return <Empty title="Analytics unavailable" body="Could not reach the backend." />;

    const maxDay = Math.max(...(stats.viewsOverTime ?? []).map((d) => d.views), 1);

    return (
        <>
            <div className={statGrid}>
                <Stat label="Views" value={count(stats.totalViews)} />
                <Stat label="Watch hours" value={stats.totalWatchHours.toFixed(1)} />
                <Stat
                    label="Avg retention"
                    value={`${(stats.avgWatchRatio * 100).toFixed(0)}%`}
                    accent="var(--sig-engagement)"
                />
                <Stat label="Subscribers" value={count(stats.totalSubscribers)} />
                <Stat label="Videos" value={String(stats.totalVideos)} />
                <Stat label="Likes" value={count(stats.totalLikes)} />
            </div>

            {stats.viewsOverTime?.length > 0 && (
                <section className="mb-[30px]">
                    <p className={eyebrow + " mb-2.5"}>Views, last 30 days</p>
                    <div className="flex items-end gap-[3px] h-[90px]">
                        {stats.viewsOverTime.map((d) => (
                            <div
                                key={d.date}
                                className="flex-1 min-w-[3px] bg-sig-content rounded-t-sm opacity-90"
                                title={`${d.date}: ${d.views} views`}
                                style={{ height: `${Math.max((d.views / maxDay) * 100, 3)}%` }}
                            />
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}

async function VideoTable() {
    const page = await safe<Paginated<Video>>(
        serverApi.myVideos({ limit: 25 }),
        { docs: [], totalDocs: 0, page: 1, totalPages: 0, hasNextPage: false }
    );

    if (!page.docs.length) {
        return (
            <Empty
                title="No uploads yet"
                body="Publish your first video to start collecting analytics."
                actionLabel="Upload a video"
                actionHref="/upload"
            />
        );
    }

    return (
        <>
            <p className={eyebrow + " mb-2.5"}>Your videos</p>
            <div className="overflow-x-auto">
                <table className={table}>
                    <thead>
                        <tr>
                            <th className={tableTh + " text-left"}>Video</th>
                            <th className={tableTh + " text-left"}>Status</th>
                            <th className={tableTh + " text-right"}>Views</th>
                            <th className={tableTh + " text-right"}>Retention</th>
                            <th className={tableTh + " text-right"}>Likes</th>
                            <th className={tableTh + " text-right"}>Published</th>
                        </tr>
                    </thead>
                    <tbody>
                        {page.docs.map((v) => (
                            <tr key={v._id}>
                                <td className={tableTd}>
                                    <div className="flex items-center gap-2.5">
                                        <img src={v.thumbnail} alt="" className="w-[76px] aspect-video object-cover rounded-md bg-surface-2" />
                                        <div className="min-w-0">
                                            <div className="font-medium line-clamp-1">{v.title}</div>
                                            <div className={mono + " text-xs text-text-dim"}>
                                                {duration(v.duration)} · {v.category}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className={tableTd}>
                                    <span
                                        className={mono + " text-xs font-medium"}
                                        style={{ color: v.isPublished ? "var(--ok)" : "var(--text-faint)" }}
                                    >
                                        {v.transcodeStatus !== "ready"
                                            ? v.transcodeStatus
                                            : v.isPublished
                                              ? "live"
                                              : "draft"}
                                    </span>
                                </td>
                                <td className={tableTdNum}>{count(v.views)}</td>
                                <td className={tableTdNum}>{((v.avgWatchRatio ?? 0) * 100).toFixed(0)}%</td>
                                <td className={tableTdNum}>{count(v.likesCount)}</td>
                                <td className={tableTdNum}>{ago(v.createdAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className={stat}>
            <div className={eyebrow}>{label}</div>
            <div className={statV} style={accent ? { color: accent } : undefined}>{value}</div>
        </div>
    );
}

function StatsSkeleton() {
    return (
        <div className={statGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={skeleton + " h-[72px]"} />
            ))}
        </div>
    );
}
