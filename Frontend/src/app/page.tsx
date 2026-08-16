import { Suspense } from "react";
import { serverApi, safe, getCurrentUser } from "@/lib/api-server";
import VideoGrid, { GridSkeleton } from "@/components/VideoGrid";
import VideoCard from "@/components/VideoCard";
import ScoringToggle from "@/components/ScoringToggle";
import Empty from "@/components/Empty";
import type { Feed, Video } from "@/types";

/**
 * Home feed — a Server Component.
 *
 * The whole personalised slate is fetched and rendered before the response is
 * sent, so the user sees real videos in the first paint rather than a skeleton
 * that resolves a round trip later. That's the main practical reason to be on
 * Next.js here: the feed is the slowest call in the app (five retrieval
 * sources plus a ranking pass) and moving it server-side removes it from the
 * critical path entirely.
 */

// Reading cookies makes this dynamic anyway; being explicit documents why.
export const dynamic = "force-dynamic";

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ explain?: string }>;
}) {
    const { explain } = await searchParams;
    const user = await getCurrentUser();

    return (
        <>
            {user && (
                <Suspense fallback={null}>
                    <ContinueWatching />
                </Suspense>
            )}

            <Suspense fallback={<FeedSkeleton signedIn={Boolean(user)} />}>
                <PersonalisedFeed explain={explain === "true"} signedIn={Boolean(user)} />
            </Suspense>
        </>
    );
}

async function PersonalisedFeed({
    explain,
    signedIn,
}: {
    explain: boolean;
    signedIn: boolean;
}) {
    let feed: Feed | null = null;
    let error: string | null = null;

    try {
        feed = await serverApi.feed({ limit: 24, explain: explain || undefined });
    } catch (e) {
        error = e instanceof Error ? e.message : "Unknown error";
    }

    const items = feed?.items ?? [];

    return (
        <>
            <div className="feed-head">
                <h1 className="h-display">{signedIn ? "For you" : "Popular now"}</h1>

                {/* The strategy readout is the point: the feed says out loud
                    which path produced it instead of pretending it's magic. */}
                {feed?.strategy && (
                    <span className="eyebrow">
                        {feed.strategy === "personalised"
                            ? `personalised · ${feed.candidatePoolSize} candidates ranked`
                            : feed.strategy === "cold_start"
                              ? "cold start · trending + freshness"
                              : "fallback"}
                    </span>
                )}

                {signedIn && <ScoringToggle />}
            </div>

            {error ? (
                <Empty
                    title="Couldn't load the feed"
                    body={`${error}. Check the backend is running on port 8000.`}
                    actionLabel="Reload"
                    actionHref="/"
                />
            ) : items.length === 0 ? (
                <Empty
                    title="Nothing here yet"
                    body="Seed the database with npm run seed, then npm run jobs to build the recommendation index."
                    actionLabel="Upload a video"
                    actionHref="/upload"
                />
            ) : (
                <>
                    <VideoGrid videos={items} feedSource="home" />
                    {explain && (
                        <p className="eyebrow" style={{ marginTop: 22, color: "var(--text-dim)" }}>
                            Coloured pips show which retrieval source surfaced each video. Open one
                            to see the full score breakdown.
                        </p>
                    )}
                </>
            )}
        </>
    );
}

/**
 * Streamed separately so a slow continue-watching query never delays the main
 * feed — Suspense lets each section arrive when it's ready.
 */
async function ContinueWatching() {
    const items = await safe<Video[]>(serverApi.continueWatching(), []);
    if (!items.length) return null;

    return (
        <section style={{ marginBottom: 38 }}>
            <div className="feed-head">
                <h2 className="h-display" style={{ fontSize: 18 }}>Continue watching</h2>
            </div>
            <div className="grid">
                {items.slice(0, 4).map((v) => (
                    <VideoCard key={v._id} video={v} feedSource="home" />
                ))}
            </div>
        </section>
    );
}

function FeedSkeleton({ signedIn }: { signedIn: boolean }) {
    return (
        <>
            <div className="feed-head">
                <h1 className="h-display">{signedIn ? "For you" : "Popular now"}</h1>
            </div>
            <GridSkeleton />
        </>
    );
}
