"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { count } from "@/lib/format";
import Icon from "./Icon";
import { btn, btnPrimary } from "@/lib/ui";
import type { Video } from "@/types";

/**
 * The channel row: who made this, whether you're subscribed, and what you can
 * do about the video.
 *
 * Split out of the watch page so the rest of it can stay a Server Component —
 * only the parts that need state ship JS. It owns the whole row rather than
 * just the two buttons because Subscribe belongs inside the channel group and
 * Like belongs in the action cluster on the other side of it, and a component
 * can't render into two parents.
 *
 * Both toggles are optimistic: they're cheap to reverse and the latency is
 * more annoying than the rare rollback.
 */
export default function WatchActions({ video }: { video: Video }) {
    const { user } = useAuth();
    const [liked, setLiked] = useState(Boolean(video.isLiked));
    const [likes, setLikes] = useState(video.likesCount ?? 0);
    const [subscribed, setSubscribed] = useState(Boolean(video.owner?.isSubscribed));

    const toggleLike = async () => {
        const next = !liked;
        setLiked(next);
        setLikes((n) => n + (next ? 1 : -1));
        try {
            const res = await api.likeVideo(video._id);
            setLiked(res.liked);
        } catch {
            setLiked(!next);
            setLikes((n) => n + (next ? -1 : 1));
        }
    };

    const toggleSub = async () => {
        const next = !subscribed;
        setSubscribed(next);
        try {
            const res = await api.subscribe(video.owner._id);
            setSubscribed(res.subscribed);
        } catch {
            setSubscribed(!next);
        }
    };

    const owner = video.owner;

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mt-3">
            <div className="flex items-center gap-3 min-w-0">
                <Link
                    className="flex items-center gap-3 min-w-0"
                    href={`/channel/${owner.username}`}
                >
                    <img
                        className="w-10 h-10 rounded-full object-cover bg-surface-2 shrink-0"
                        src={owner.avatar}
                        alt=""
                    />
                    <span className="min-w-0">
                        <span className="block text-base font-medium leading-tight truncate">
                            {owner.fullName || owner.username}
                        </span>
                        <span className="block text-xs text-text-dim mt-0.5">
                            {count(owner.subscribersCount ?? 0)} subscribers
                        </span>
                    </span>
                </Link>

                {user && owner._id !== user._id && (
                    <button
                        className={subscribed ? btn : btnPrimary}
                        onClick={toggleSub}
                    >
                        {subscribed ? "Subscribed" : "Subscribe"}
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {/* Joined Like | Dislike pill. The divider is a 1px span rather
                    than a border so the two hover targets stay flush. */}
                <div className="flex items-stretch h-9 rounded-full bg-surface-2 overflow-hidden">
                    {user ? (
                        <button
                            className={
                                "flex items-center gap-2 pl-4 pr-3.5 text-sm font-medium transition-colors duration-100 hover:bg-surface-3 " +
                                (liked ? "bg-surface-3" : "")
                            }
                            onClick={toggleLike}
                            aria-pressed={liked}
                            aria-label={liked ? "Remove like" : "Like this video"}
                        >
                            <Icon name="like" size={22} />
                            <span className="[font-variant-numeric:tabular-nums]">
                                {count(likes)}
                            </span>
                        </button>
                    ) : (
                        <span className="flex items-center gap-2 pl-4 pr-3.5 text-sm font-medium text-text-dim">
                            <Icon name="like" size={22} />
                            <span className="[font-variant-numeric:tabular-nums]">
                                {count(likes)}
                            </span>
                        </span>
                    )}

                    <span className="self-center w-px h-6 bg-line-bright" aria-hidden="true" />

                    {/* No dislike endpoint in this build; present for the layout. */}
                    <span
                        className="grid place-items-center px-4 text-text-dim"
                        title="Dislike"
                        aria-hidden="true"
                    >
                        <Icon name="dislike" size={22} />
                    </span>
                </div>

                {/* Likewise: the share, download and overflow affordances are
                    part of YouTube's row but have no backend here. */}
                <span className={btn + " text-text-dim cursor-default"} title="Share">
                    <Icon name="share" size={22} />
                    <span className="hidden sm:inline">Share</span>
                </span>
                <span className={btn + " text-text-dim cursor-default"} title="Download">
                    <Icon name="download" size={22} />
                    <span className="hidden sm:inline">Download</span>
                </span>
                <span
                    className="grid place-items-center w-9 h-9 rounded-full bg-surface-2 text-text-dim cursor-default"
                    title="More actions"
                >
                    <Icon name="more" size={22} />
                </span>
            </div>
        </div>
    );
}
