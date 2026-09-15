import Link from "next/link";
import { duration, count, ago } from "@/lib/format";
import { SourcePips } from "./SignalBars";
import { skeleton, skThumb, skLine, skLineShort, railItem, clamp2, avatar } from "@/lib/ui";
import type { Video } from "@/types";

/**
 * A Server Component — cards are the bulk of every page, and none of them need
 * client JS. Rendering them on the server keeps the feed's hydration cost flat
 * no matter how many videos are on screen.
 *
 * Two shapes from one component: the grid card (thumbnail over a 36px avatar
 * beside the title) and the rail card (168px thumbnail to the left of the
 * text) the watch page's recommendations use.
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

    const rail = layout === "rail";

    return (
        <Link className={rail ? "min-w-0 group/card " + railItem : "block min-w-0 group/card"} href={href}>
            {/* aspect-video + object-cover together are what stop a 4:3 or
                portrait source letterboxing or stretching the grid. */}
            <div
                className={
                    "relative aspect-video w-full overflow-hidden bg-surface-2 " +
                    (rail ? "rounded-md" : "rounded-lg")
                }
            >
                <img
                    src={video.thumbnail}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                />
                {video.duration > 0 && (
                    <span className="absolute right-1 bottom-1 bg-badge text-white rounded-sm px-1 py-px text-xs font-medium leading-[1.3] [font-variant-numeric:tabular-nums]">
                        {duration(video.duration)}
                    </span>
                )}
                {typeof video.progress === "number" && video.progress > 0 && (
                    <div className="absolute left-0 right-0 bottom-0 h-1 bg-[rgba(255,255,255,0.3)]">
                        <span
                            className="block h-full bg-brand"
                            style={{ width: `${Math.min(video.progress * 100, 100)}%` }}
                        />
                    </div>
                )}
            </div>

            {rail ? (
                <div className="min-w-0">
                    <h3 className={"text-sm font-medium leading-[1.4] m-0 mb-1 " + clamp2}>
                        {video.title}
                    </h3>
                    <p className="text-xs text-text-dim m-0 truncate">
                        {owner.fullName || owner.username}
                    </p>
                    <p className="text-xs text-text-dim mt-0.5 mb-0 truncate">
                        {count(video.views ?? 0)} views · {ago(video.createdAt)}
                    </p>
                    {rec?.sources && <SourcePips sources={rec.sources} />}
                </div>
            ) : (
                /* 12px gutter, avatar locked to the top of the title — the two
                   things that keep a wall of cards from looking ragged. */
                <div className="flex items-start gap-3 pt-3">
                    <img
                        className={avatar + " mt-0.5"}
                        src={owner.avatar}
                        alt=""
                        loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                        <h3 className={"text-sm font-medium leading-[1.4] m-0 mb-1.5 " + clamp2}>
                            {video.title}
                        </h3>
                        <p className="text-[13px] text-text-dim m-0 truncate group-hover/card:text-text transition-colors duration-100">
                            {owner.fullName || owner.username}
                        </p>
                        <p className="text-[13px] text-text-dim m-0 truncate">
                            {count(video.views ?? 0)} views · {ago(video.createdAt)}
                        </p>
                        {rec?.sources && <SourcePips sources={rec.sources} />}
                    </div>
                </div>
            )}
        </Link>
    );
}

export function CardSkeleton({ layout = "grid" }: { layout?: "grid" | "rail" }) {
    if (layout === "rail") {
        return (
            <div className={railItem}>
                <div className={skeleton + " aspect-video rounded-md"} />
                <div>
                    <div className={skeleton + " h-3"} />
                    <div className={skeleton + " " + skLine + " " + skLineShort} />
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className={skeleton + " " + skThumb} />
            <div className="flex items-start gap-3 pt-3">
                <div className={skeleton + " w-9 h-9 rounded-full shrink-0"} />
                <div className="flex-1">
                    <div className={skeleton + " h-3.5"} />
                    <div className={skeleton + " " + skLine + " " + skLineShort} />
                </div>
            </div>
        </div>
    );
}
