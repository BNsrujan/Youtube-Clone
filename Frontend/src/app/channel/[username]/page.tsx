import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serverApi, safe, ServerApiError } from "@/lib/api-server";
import VideoGrid, { GridSkeleton } from "@/components/VideoGrid";
import Empty from "@/components/Empty";
import { count } from "@/lib/format";
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
                <div className="cover" style={{ backgroundImage: `url(${channel.coverImage})` }} />
            )}

            <div className="channel-head">
                <img src={channel.avatar} alt="" />
                <div>
                    <h1 className="h-display" style={{ fontSize: 24 }}>
                        {channel.fullName || channel.username}
                    </h1>
                    <p className="mono" style={{ color: "var(--text-faint)", fontSize: 12, margin: "4px 0 0" }}>
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
