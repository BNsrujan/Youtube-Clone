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
import Empty from "@/components/Empty";
import { count, ago } from "@/lib/format";
import { avatar, btn, mono, tag, skeleton, skLine, railList } from "@/lib/ui";
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
    const owner = video.owner;

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_372px] gap-7 items-start max-[1080px]:grid-cols-[minmax(0,1fr)]">
            <div>
                {/* The only client component on the critical path. Everything
                    below it is server-rendered and ships no JS. */}
                <VideoPlayer
                    videoId={videoId}
                    source={from ?? "direct"}
                    rankPosition={pos ? Number(pos) : undefined}
                />

                <h1 className="text-xl font-bold leading-[1.3] mt-[18px] mb-3 max-[720px]:text-[17px]">
                    {video.title}
                </h1>

                <div className="flex items-center gap-3.5 flex-wrap pb-4 border-b border-line">
                    <Link className="flex items-center gap-[10px]" href={`/channel/${owner.username}`}>
                        <img className={avatar} src={owner.avatar} alt="" />
                        <span>
                            <span className="font-semibold text-sm">{owner.fullName || owner.username}</span>
                            <br />
                            <span className="font-mono text-[11.5px] text-text-faint">
                                {count(owner.subscribersCount ?? 0)} subscribers
                            </span>
                        </span>
                    </Link>

                    <div className="ml-auto flex gap-2 max-[720px]:ml-0 max-[720px]:w-full">
                        <span className={btn + " " + mono} style={{ cursor: "default", fontSize: 12 }}>
                            {count(video.views ?? 0)} views · {ago(video.createdAt)}
                        </span>
                        <WatchActions video={video} />
                    </div>
                </div>

                {user && <WhyPanel videoId={videoId} />}

                <div className="bg-surface border border-line rounded-md px-4 py-3.5 mt-4 text-[13.5px] whitespace-pre-wrap">
                    {video.description}
                </div>

                {video.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {video.tags.map((t) => (
                            <Link key={t} className={tag} href={`/search?q=${encodeURIComponent(t)}`}>
                                #{t}
                            </Link>
                        ))}
                    </div>
                )}

                <Suspense fallback={<div className={skeleton + " " + skLine} style={{ marginTop: 30 }} />}>
                    <CommentSection videoId={videoId} />
                </Suspense>
            </div>

            <aside>
                <RailTabs
                    related={
                        <Suspense fallback={<RailSkeleton />}>
                            <RelatedRail videoId={videoId} />
                        </Suspense>
                    }
                    profile={
                        <Suspense fallback={<div className={skeleton + " " + skLine} style={{ height: 90 }} />}>
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
            <p className="text-text-faint text-[13px]">
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
