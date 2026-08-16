import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { serverApi, safe, isAuthenticated } from "@/lib/api-server";
import Empty from "@/components/Empty";
import { count, duration, ago } from "@/lib/format";
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
            <div className="feed-head">
                <h1 className="h-display">Studio</h1>
                <span className="eyebrow">your channel</span>
            </div>

            <Suspense fallback={<StatsSkeleton />}>
                <Overview />
            </Suspense>

            <Suspense fallback={<div className="skeleton sk-line" style={{ height: 120, marginTop: 20 }} />}>
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
            <div className="stat-grid">
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
                <section style={{ marginBottom: 30 }}>
                    <p className="eyebrow" style={{ marginBottom: 10 }}>Views, last 30 days</p>
                    <div className="chart-bars">
                        {stats.viewsOverTime.map((d) => (
                            <div
                                key={d.date}
                                className="chart-bar"
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
            <p className="eyebrow" style={{ marginBottom: 10 }}>Your videos</p>
            <div style={{ overflowX: "auto" }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Video</th>
                            <th>Status</th>
                            <th style={{ textAlign: "right" }}>Views</th>
                            <th style={{ textAlign: "right" }}>Retention</th>
                            <th style={{ textAlign: "right" }}>Likes</th>
                            <th style={{ textAlign: "right" }}>Published</th>
                        </tr>
                    </thead>
                    <tbody>
                        {page.docs.map((v) => (
                            <tr key={v._id}>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <img src={v.thumbnail} alt="" style={{ width: 76, borderRadius: 3 }} />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600 }}>{v.title}</div>
                                            <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                                                {duration(v.duration)} · {v.category}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span
                                        className="mono"
                                        style={{
                                            fontSize: 11,
                                            color: v.isPublished ? "var(--ok)" : "var(--text-faint)",
                                        }}
                                    >
                                        {v.transcodeStatus !== "ready"
                                            ? v.transcodeStatus
                                            : v.isPublished
                                              ? "live"
                                              : "draft"}
                                    </span>
                                </td>
                                <td className="num">{count(v.views)}</td>
                                <td className="num">{((v.avgWatchRatio ?? 0) * 100).toFixed(0)}%</td>
                                <td className="num">{count(v.likesCount)}</td>
                                <td className="num">{ago(v.createdAt)}</td>
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
        <div className="stat">
            <div className="eyebrow">{label}</div>
            <div className="stat-v" style={accent ? { color: accent } : undefined}>{value}</div>
        </div>
    );
}

function StatsSkeleton() {
    return (
        <div className="stat-grid">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 72 }} />
            ))}
        </div>
    );
}
