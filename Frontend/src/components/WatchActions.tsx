"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { count } from "@/lib/format";
import type { Video } from "@/types";

/**
 * Like and subscribe.
 *
 * Split out of the watch page so the rest of it can stay a Server Component —
 * only the two buttons that need state ship JS.
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

    if (!user) {
        return (
            <span className="btn" style={{ cursor: "default" }}>
                {count(likes)} likes
            </span>
        );
    }

    return (
        <>
            {video.owner._id !== user._id && (
                <button className={`btn${subscribed ? "" : " btn-primary"}`} onClick={toggleSub}>
                    {subscribed ? "Subscribed" : "Subscribe"}
                </button>
            )}
            <button
                className={`btn${liked ? " btn-on" : ""}`}
                onClick={toggleLike}
                aria-pressed={liked}
            >
                {liked ? "Liked" : "Like"} · {count(likes)}
            </button>
        </>
    );
}
