import { Suspense } from "react";
import type { Metadata } from "next";
import { serverApi, safe } from "@/lib/api-server";
import VideoGrid, { GridSkeleton } from "@/components/VideoGrid";
import Empty from "@/components/Empty";
import type { Paginated, Video } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
    const { q } = await searchParams;
    return { title: q ? `${q} · videotube` : "Search · videotube" };
}

export default async function SearchPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q = "" } = await searchParams;

    if (!q.trim()) {
        return <Empty title="Search videos" body="Type a query in the bar above." />;
    }

    return (
        <Suspense key={q} fallback={<GridSkeleton count={8} />}>
            <Results q={q} />
        </Suspense>
    );
}

async function Results({ q }: { q: string }) {
    const page = await safe<Paginated<Video>>(
        serverApi.videos({ query: q, limit: 24 }),
        { docs: [], totalDocs: 0, page: 1, totalPages: 0, hasNextPage: false }
    );

    return (
        <>
            <div className="feed-head">
                <h1 className="h-display" style={{ fontSize: 20 }}>
                    Results for &ldquo;{q}&rdquo;
                </h1>
                <span className="eyebrow">{page.totalDocs} found</span>
            </div>

            {page.docs.length === 0 ? (
                <Empty
                    title={`Nothing matches “${q}”`}
                    body="Try fewer or broader words. Search covers titles, descriptions and tags."
                    actionLabel="Back to feed"
                    actionHref="/"
                />
            ) : (
                <VideoGrid videos={page.docs} feedSource="search" />
            )}
        </>
    );
}
