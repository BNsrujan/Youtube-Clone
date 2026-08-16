import Link from "next/link";
import { duration, count, ago } from "@/lib/format";
import { SourcePips } from "./SignalBars";
import { skeleton, skThumb, skLine, skLineShort, railItem } from "@/lib/ui";
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

    const rail = layout === "rail";

    return (
        <Link className={rail ? "min-w-0 group " + railItem : "block min-w-0 group"} href={href}>
            <div
                className={
                    "relative aspect-video bg-surface-2 overflow-hidden border border-line " +
                    (rail ? "rounded-sm" : "rounded-md")
                }
            >
                <img
                    src={video.thumbnail}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-[350ms] ease-in-out group-hover:scale-[1.035]"
                />
                {video.duration > 0 && (
                    <span className="absolute right-1.5 bottom-1.5 bg-[rgba(6,10,15,0.88)] rounded-sm px-[5px] py-px font-mono text-[11px] font-medium">
                        {duration(video.duration)}
                    </span>
                )}
                {typeof video.progress === "number" && video.progress > 0 && (
                    <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-[rgba(6,10,15,0.6)]">
                        <span
                            className="block h-full bg-live"
                            style={{ width: `${Math.min(video.progress * 100, 100)}%` }}
                        />
                    </div>
                )}
            </div>

            <div className="pt-2.5">
                <h3
                    className={
                        "font-semibold leading-[1.35] m-0 line-clamp-2 " +
                        (rail ? "text-[13px] mb-[3px]" : "text-sm mb-1")
                    }
                >
                    {video.title}
                </h3>
                <p className="text-[12.5px] text-text-dim m-0">{owner.fullName || owner.username}</p>
                <p className="font-mono text-[11.5px] text-text-faint mt-0.5 mb-0">
                    {count(video.views ?? 0)} views · {ago(video.createdAt)}
                </p>
                {rec?.sources && <SourcePips sources={rec.sources} />}
            </div>
        </Link>
    );
}

export function CardSkeleton({ layout = "grid" }: { layout?: "grid" | "rail" }) {
    return (
        <div className={layout === "rail" ? railItem : undefined}>
            <div className={skeleton + " " + skThumb} />
            <div>
                <div className={skeleton + " " + skLine} />
                <div className={skeleton + " " + skLine + " " + skLineShort} />
            </div>
        </div>
    );
}
