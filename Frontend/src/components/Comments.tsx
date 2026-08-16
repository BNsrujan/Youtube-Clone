"use client";

import { useState, useEffect, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { ago } from "@/lib/format";
import { eyebrow, avatar, btnPrimary, btn } from "@/lib/ui";
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
        <section className="mt-[30px]">
            <p className={eyebrow + " mb-3.5"}>
                {total} comments
            </p>

            {user && (
                <form onSubmit={submit} className="flex gap-2.5 mb-[22px]">
                    <img className={avatar} src={user.avatar} alt="" />
                    <input
                        className="flex-1 bg-transparent border-0 border-b border-line px-0.5 py-1.5 text-[13.5px] focus:outline-none focus:border-b-line-bright"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Add a comment"
                        aria-label="Add a comment"
                        maxLength={5000}
                    />
                    <button className={btnPrimary} disabled={!text.trim() || posting}>
                        {posting ? "Posting" : "Comment"}
                    </button>
                </form>
            )}

            {comments.length === 0 ? (
                <p className="text-text-faint text-[13px]">
                    No comments yet.{user ? " Start the conversation." : " Sign in to comment."}
                </p>
            ) : (
                comments.map((c) => (
                    <div key={c._id} className="flex gap-[10px] mb-4">
                        <img className={avatar} src={c.owner?.avatar} alt="" />
                        <div className="min-w-0">
                            <p className="m-0 text-[12.5px]">
                                <strong>{c.owner?.username}</strong>{" "}
                                <span className="text-text-faint">{ago(c.createdAt)}</span>
                            </p>
                            <p className="mt-0.5 mb-0 text-[13.5px]">{c.content}</p>
                        </div>
                        {user?._id === c.owner?._id && (
                            <button
                                className={btn}
                                style={{ marginLeft: "auto", fontSize: 11, padding: "3px 9px" }}
                                onClick={() => remove(c._id)}
                            >
                                Delete
                            </button>
                        )}
                    </div>
                ))
            )}
        </section>
    );
}
