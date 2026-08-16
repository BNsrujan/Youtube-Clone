"use client";

import { useState, useEffect, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { ago } from "@/lib/format";
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
        <section style={{ marginTop: 30 }}>
            <p className="eyebrow" style={{ marginBottom: 14 }}>
                {total} comments
            </p>

            {user && (
                <form onSubmit={submit} style={{ display: "flex", gap: 10, marginBottom: 22 }}>
                    <img className="avatar" src={user.avatar} alt="" />
                    <input
                        className="comment-input"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Add a comment"
                        aria-label="Add a comment"
                        maxLength={5000}
                    />
                    <button className="btn btn-primary" disabled={!text.trim() || posting}>
                        {posting ? "Posting" : "Comment"}
                    </button>
                </form>
            )}

            {comments.length === 0 ? (
                <p style={{ color: "var(--text-faint)", fontSize: 13 }}>
                    No comments yet.{user ? " Start the conversation." : " Sign in to comment."}
                </p>
            ) : (
                comments.map((c) => (
                    <div key={c._id} className="comment">
                        <img className="avatar" src={c.owner?.avatar} alt="" />
                        <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12.5 }}>
                                <strong>{c.owner?.username}</strong>{" "}
                                <span style={{ color: "var(--text-faint)" }}>{ago(c.createdAt)}</span>
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: 13.5 }}>{c.content}</p>
                        </div>
                        {user?._id === c.owner?._id && (
                            <button
                                className="btn"
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
