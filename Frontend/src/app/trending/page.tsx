import { Suspense } from "react";
import type { Metadata } from "next";
import { serverApi, safe } from "@/lib/api-server";
import VideoGrid, { GridSkeleton } from "@/components/VideoGrid";
import CategoryFilter from "@/components/CategoryFilter";
import Empty from "@/components/Empty";
import { feedHead, hDisplay, eyebrow } from "@/lib/ui";
import type { Video } from "@/types";

export const metadata: Metadata = { title: "Trending · videotube" };
export const dynamic = "force-dynamic";

export default async function TrendingPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>;
}) {
    const { category } = await searchParams;

    return (
        <>
            <div className="sticky top-nav z-20 bg-bg -mt-3">
                <Suspense fallback={<div className="h-14" />}>
                    <CategoryFilter />
                </Suspense>
            </div>

            <div className={feedHead}>
                <h1 className={hDisplay + " text-xl"}>Trending</h1>
                <span className={eyebrow}>
                    log₁₀(engagement) − age/12h · recomputed every 30 min
                </span>
            </div>

            <Suspense key={category ?? "all"} fallback={<GridSkeleton />}>
                <TrendingGrid category={category} />
            </Suspense>
        </>
    );
}

async function TrendingGrid({ category }: { category?: string }) {
    const videos = await safe<Video[]>(
        serverApi.trending({ limit: 24, category }),
        []
    );

    if (!videos.length) {
        return (
            <Empty
                title="No trending videos"
                body="Trending needs watch activity in the last 72 hours. Run npm run jobs after seeding."
                actionLabel="Back to feed"
                actionHref="/"
            />
        );
    }

    return <VideoGrid videos={videos} feedSource="trending" />;
}
