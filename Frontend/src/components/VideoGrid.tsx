import VideoCard, { CardSkeleton } from "./VideoCard";
import { grid } from "@/lib/ui";
import type { Video } from "@/types";

export default function VideoGrid({
    videos,
    feedSource,
}: {
    videos: Video[];
    feedSource?: string;
}) {
    return (
        <div className={grid}>
            {videos.map((v, i) => (
                <VideoCard key={v._id} video={v} position={i} feedSource={feedSource} />
            ))}
        </div>
    );
}

/** Used as the Suspense fallback while a server page streams its data. */
export function GridSkeleton({ count = 12 }: { count?: number }) {
    return (
        <div className={grid}>
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}
