import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serverApi, safe, getCurrentUser, ServerApiError } from "@/lib/api-server";
import VideoPlayer from "@/components/VideoPlayer";
import VideoCard, { CardSkeleton } from "@/components/VideoCard";
import WatchActions from "@/components/WatchActions";
import WhyPanel from "@/components/WhyPanel";
import TasteProfilePanel from "@/components/TasteProfilePanel";
import Comments from "@/components/Comments";
import RailTabs from "@/components/RailTabs";
import Description from "@/components/Description";
import Empty from "@/components/Empty";
import { count, ago } from "@/lib/format";
import { tag, skeleton, skLine, railList } from "@/lib/ui";
import type { Video, Comment, TasteProfile, Paginated } from "@/types";

export const dynamic = "force-dynamic";

/** Server-rendered metadata — a shared watch link gets a real title and card. */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ videoId: string }>;
}): Promise<Metadata> {
    const { videoId } = await params;
    try {
        const video = await serverApi.video(videoId);
        return {
            title: `${video.title} · videotube`,
            description: video.description?.slice(0, 160),
            openGraph: {
                title: video.title,
                description: video.description?.slice(0, 160),
                images: video.thumbnail ? [video.thumbnail] : undefined,
                type: "video.other",
            },
        };
    } catch {
        return { title: "videotube" };
    }
}

export default async function WatchPage({
    params,
    searchParams,
}: {
    params: Promise<{ videoId: string }>;
    searchParams: Promise<{ from?: string; pos?: string }>;
}) {
    const { videoId } = await params;
    const { from, pos } = await searchParams;

    let video: Video;
    try {
        video = await serverApi.video(videoId);
    } catch (e) {
        // A missing or private video is a genuine 404 — let Next render it.
        if (e instanceof ServerApiError && (e.status === 404 || e.status === 403)) notFound();

        // Anything else (backend down, network fault) is rendered here rather
        // than rethrown. error.tsx is a client boundary, so a throw at this
        // point streams an empty shell and the message only appears after
        // hydration — useless without JS and invisible to a crawler.
        return (
            <Empty
                title="Can't load this video"
                body={`${e instanceof Error ? e.message : "Unknown error"}. Check the backend is running on port 8000.`}
                actionLabel="Back to feed"
                actionHref="/"
            />
        );
    }

    const user = await getCurrentUser();

    return (
        /* Two columns on desktop: the player column takes what's left up to
           1280px, the recommendations rail is a fixed 402px beside it. Below
           1024px the rail drops under the comments and everything is one
           column. */
        <div className="flex flex-col lg:flex-row gap-6 items-start max-w-[1754px] mx-auto">
            <div className="w-full lg:flex-1 min-w-0 max-w-watch">
                {/* The only client component on the critical path. Everything
                    below it is server-rendered and ships no JS. */}
                <VideoPlayer
                    videoId={videoId}
                    source={from ?? "direct"}
                    rankPosition={pos ? Number(pos) : undefined}
                />

                <h1 className="text-xl font-medium leading-snug mt-4 mb-0 max-[720px]:text-lg">
                    {video.title}
                </h1>

                <WatchActions video={video} />

                <Description
                    meta={`${count(video.views ?? 0)} views · ${ago(video.createdAt)}`}
                    text={video.description}
                >
                    {video.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {video.tags.map((t) => (
                                <Link
                                    key={t}
                                    className={tag}
                                    href={`/search?q=${encodeURIComponent(t)}`}
                                >
                                    #{t}
                                </Link>
                            ))}
                        </div>
                    )}
                </Description>

                {user && <WhyPanel videoId={videoId} />}

                <Suspense
                    fallback={<div className={skeleton + " " + skLine + " mt-8"} />}
                >
                    <CommentSection videoId={videoId} />
                </Suspense>
            </div>

            <aside className="w-full lg:w-[402px] lg:shrink-0">
                <RailTabs
                    related={
                        <Suspense fallback={<RailSkeleton />}>
                            <RelatedRail videoId={videoId} />
                        </Suspense>
                    }
                    profile={
                        <Suspense fallback={<div className={skeleton + " h-24"} />}>
                            <ProfilePanel signedIn={Boolean(user)} />
                        </Suspense>
                    }
                />
            </aside>
        </div>
    );
}

/** Streams in independently — the player never waits on the related call. */
async function RelatedRail({ videoId }: { videoId: string }) {
    const related = await safe<Video[]>(serverApi.related(videoId, { limit: 12 }), []);

    if (!related.length) {
        return (
            <p className="text-text-dim text-[13px]">
                No related videos yet. Run npm run jobs to build the similarity index.
            </p>
        );
    }

    return (
        <div className={railList}>
            {related.map((r, i) => (
                <VideoCard key={r._id} video={r} layout="rail" position={i} feedSource="related" />
            ))}
        </div>
    );
}

async function ProfilePanel({ signedIn }: { signedIn: boolean }) {
    if (!signedIn) return <TasteProfilePanel profile={null} />;
    const profile = await safe<TasteProfile | null>(serverApi.tasteProfile(), null);
    return <TasteProfilePanel profile={profile} />;
}

async function CommentSection({ videoId }: { videoId: string }) {
    const data = await safe<Paginated<Comment>>(
        serverApi.comments(videoId, { limit: 20 }),
        { docs: [], totalDocs: 0, page: 1, totalPages: 0, hasNextPage: false }
    );

    return (
        <Comments
            videoId={videoId}
            initialComments={data.docs}
            initialTotal={data.totalDocs}
        />
    );
}

function RailSkeleton() {
    return (
        <div className={railList}>
            {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} layout="rail" />
            ))}
        </div>
    );
}
