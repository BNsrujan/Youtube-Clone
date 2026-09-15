import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serverApi, safe, ServerApiError } from "@/lib/api-server";
import VideoGrid, { GridSkeleton } from "@/components/VideoGrid";
import Empty from "@/components/Empty";
import { count } from "@/lib/format";
import { hDisplay, mono } from "@/lib/ui";
import type { User, Paginated, Video } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ username: string }>;
}): Promise<Metadata> {
    const { username } = await params;
    return { title: `@${username} · videotube` };
}

export default async function ChannelPage({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const { username } = await params;

    let channel: User;
    try {
        channel = await serverApi.channel(username);
    } catch (e) {
        if (e instanceof ServerApiError && e.status === 404) notFound();
        return (
            <Empty
                title="Can't load this channel"
                body={`${e instanceof Error ? e.message : "Unknown error"}. Check the backend is running on port 8000.`}
                actionLabel="Back to feed"
                actionHref="/"
            />
        );
    }

    return (
        <>
            {channel.coverImage && (
                <div
                    className="aspect-[6/1] min-h-[100px] rounded-lg bg-cover bg-center bg-surface-2 mb-4"
                    style={{ backgroundImage: `url(${channel.coverImage})` }}
                />
            )}

            <div className="flex items-center gap-6 mb-8 flex-wrap">
                <img
                    className="w-20 h-20 sm:w-[128px] sm:h-[128px] rounded-full object-cover bg-surface-2 shrink-0"
                    src={channel.avatar}
                    alt=""
                />
                <div className="min-w-0">
                    <h1 className={hDisplay + " text-2xl sm:text-4xl"}>
                        {channel.fullName || channel.username}
                    </h1>
                    <p className={mono + " text-text-dim text-sm mt-2 mb-0"}>
                        @{channel.username} · {count(channel.subscribersCount ?? 0)} subscribers
                    </p>
                </div>
            </div>

            <Suspense fallback={<GridSkeleton count={8} />}>
                <ChannelVideos channelId={channel._id} name={channel.fullName || username} />
            </Suspense>
        </>
    );
}

async function ChannelVideos({ channelId, name }: { channelId: string; name: string }) {
    const page = await safe<Paginated<Video>>(
        serverApi.videos({ userId: channelId, limit: 24 }),
        { docs: [], totalDocs: 0, page: 1, totalPages: 0, hasNextPage: false }
    );

    if (!page.docs.length) {
        return <Empty title="No videos yet" body={`${name} hasn't published anything.`} />;
    }

    return <VideoGrid videos={page.docs} feedSource="direct" />;
}
