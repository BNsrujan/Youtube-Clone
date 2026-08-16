import Link from "next/link";
import { duration, count, ago } from "@/lib/format";
import { SourcePips } from "./SignalBars";
import type { Video } from "@/types";

/**
 * A Server Component — cards are the bulk of every page, and none of them need
 * client JS. Rendering them on the server keeps the feed's hydration cost flat
 * no matter how many videos are on screen.
 *
 * Thumbnails use a plain <img> rather than next/image on purpose: the storage
 * host is deployment-configurable (Cloudinary, S3, whatever the seed data
 * uses), and next/image throws at runtime on any host missing from
 * remotePatterns. A broken thumbnail is a bad outcome; a crashed page is worse.
 */
export default function VideoCard({
    video,
    layout = "grid",
    position,
    feedSource,
}: {
    video: Video;
    layout?: "grid" | "rail";
    position?: number;
    feedSource?: string;
}) {
    if (!video) return null;

    const owner = video.owner ?? ({} as Video["owner"]);
    const rec = video._recommendation;

    // Carry the click's origin into the watch page, so heartbeats can report
    // which retrieval source actually produced a watched video.
    const params = new URLSearchParams();
    if (feedSource) params.set("from", feedSource);
    if (position !== undefined) params.set("pos", String(position));
    const href = `/watch/${video._id}${params.toString() ? `?${params}` : ""}`;

    return (
        <Link className={`card${layout === "rail" ? " rail-item" : ""}`} href={href}>
            <div className="card-thumb">
                <img src={video.thumbnail} alt="" loading="lazy" />
                {video.duration > 0 && (
                    <span className="card-dur mono">{duration(video.duration)}</span>
                )}
                {typeof video.progress === "number" && video.progress > 0 && (
                    <div className="card-progress">
                        <span style={{ width: `${Math.min(video.progress * 100, 100)}%` }} />
                    </div>
                )}
            </div>

            <div className="card-meta">
                <h3 className="card-title">{video.title}</h3>
                <p className="card-sub">{owner.fullName || owner.username}</p>
                <p className="card-stats">
                    {count(video.views ?? 0)} views · {ago(video.createdAt)}
                </p>
                {rec?.sources && <SourcePips sources={rec.sources} />}
            </div>
        </Link>
    );
}

export function CardSkeleton({ layout = "grid" }: { layout?: "grid" | "rail" }) {
    return (
        <div className={layout === "rail" ? "rail-skeleton" : undefined}>
            <div className="skeleton sk-thumb" />
            <div>
                <div className="skeleton sk-line" />
                <div className="skeleton sk-line short" />
            </div>
        </div>
    );
}
