"use client";

import { useState, useEffect, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { ago, count as fmtCount } from "@/lib/format";
import Icon from "./Icon";
import { avatar, btn, btnPrimary, iconBtnSm } from "@/lib/ui";
import type { Comment } from "@/types";

export default function Comments({
    videoId,
    initialComments,
    initialTotal,
}: {
    videoId: string;
    initialComments: Comment[];
    initialTotal: number;
}) {
    const { user } = useAuth();
    const [comments, setComments] = useState(initialComments);
    const [total, setTotal] = useState(initialTotal);
    const [text, setText] = useState("");
    const [posting, setPosting] = useState(false);

    // Server-rendered comments arrive with the page; reset when it changes.
    useEffect(() => {
        setComments(initialComments);
        setTotal(initialTotal);
    }, [initialComments, initialTotal]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        setPosting(true);
        try {
            const created = await api.addComment(videoId, text.trim());
            setComments((c) => [created, ...c]);
            setTotal((n) => n + 1);
            setText("");
        } finally {
            setPosting(false);
        }
    };

    const remove = async (id: string) => {
        const previous = comments;
        setComments((c) => c.filter((x) => x._id !== id));
        setTotal((n) => n - 1);
        try {
            await api.deleteComment(id);
        } catch {
            setComments(previous);
            setTotal((n) => n + 1);
        }
    };

    return (
        <section className="mt-8">
            <div className="flex items-center gap-8 mb-6">
                <h2 className="text-xl font-medium m-0">{total} Comments</h2>
                {/* No ordering parameter on the comments endpoint in this
                    build; the control is here for the layout. */}
                <span
                    className="flex items-center gap-2 text-sm font-medium text-text cursor-default"
                    title="Sort comments"
                >
                    <Icon name="sort" size={22} />
                    Sort by
                </span>
            </div>

            {user && (
                <form onSubmit={submit} className="flex gap-4 mb-8">
                    <img className={avatar + " w-10 h-10"} src={user.avatar} alt="" />
                    <div className="flex-1 min-w-0">
                        <input
                            className="w-full bg-transparent border-0 border-b border-line px-0 py-2 text-sm placeholder:text-text-dim focus:outline-none focus:border-b-2 focus:border-b-text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Add a comment..."
                            aria-label="Add a comment"
                            maxLength={5000}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                className={btn + " bg-transparent hover:bg-surface-2"}
                                onClick={() => setText("")}
                                disabled={!text}
                            >
                                Cancel
                            </button>
                            <button className={btnPrimary} disabled={!text.trim() || posting}>
                                {posting ? "Posting" : "Comment"}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {comments.length === 0 ? (
                <p className="text-text-dim text-[13px]">
                    No comments yet.{user ? " Start the conversation." : " Sign in to comment."}
                </p>
            ) : (
                comments.map((c) => (
                    <div key={c._id} className="flex gap-4 mb-5">
                        <img className={avatar + " w-10 h-10"} src={c.owner?.avatar} alt="" />
                        <div className="min-w-0 flex-1">
                            <p className="m-0 text-[13px] leading-tight">
                                <span className="font-medium">@{c.owner?.username}</span>{" "}
                                <span className="text-text-dim">{ago(c.createdAt)}</span>
                            </p>
                            <p className="mt-1 mb-0 text-sm whitespace-pre-wrap break-words">
                                {c.content}
                            </p>
                            <div className="flex items-center gap-1 mt-1.5 -ml-2">
                                <span
                                    className={iconBtnSm + " cursor-default"}
                                    title="Likes on this comment"
                                >
                                    <Icon name="like" size={20} />
                                </span>
                                <span className="text-xs text-text-dim [font-variant-numeric:tabular-nums] min-w-[1ch]">
                                    {c.likesCount ? fmtCount(c.likesCount) : ""}
                                </span>
                                <span
                                    className={iconBtnSm + " cursor-default"}
                                    title="Dislike"
                                >
                                    <Icon name="dislike" size={20} />
                                </span>
                                {/* Threaded replies aren't modelled by the API here. */}
                                <span className="ml-2 px-3 h-8 grid place-items-center rounded-full text-xs font-medium text-text cursor-default">
                                    Reply
                                </span>
                                {user?._id === c.owner?._id && (
                                    <button
                                        type="button"
                                        className="ml-auto px-3 h-8 rounded-full text-xs font-medium text-text-dim hover:bg-surface-2 hover:text-text transition-colors duration-100"
                                        onClick={() => remove(c._id)}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </section>
    );
}
