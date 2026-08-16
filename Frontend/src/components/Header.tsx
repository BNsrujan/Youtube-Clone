"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const params = useSearchParams();
    const [q, setQ] = useState(params.get("q") ?? "");

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    };

    return (
        <header className="masthead">
            <div className="shell masthead-inner">
                <Link href="/" className="brand">
                    <span className="brand-dot" aria-hidden="true" />
                    <span>videotube</span>
                </Link>

                <form className="search" onSubmit={submit} role="search">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search videos"
                        aria-label="Search videos"
                    />
                </form>

                <div className="masthead-right">
                    <Link className="btn" href="/trending">Trending</Link>
                    {user ? (
                        <>
                            <Link className="btn" href="/upload">Upload</Link>
                            <Link className="btn" href="/studio">Studio</Link>
                            <button className="btn" onClick={logout}>Sign out</button>
                            <Link href={`/channel/${user.username}`}>
                                {/* Plain <img>: avatar hosts are deployment-configurable
                                    and next/image throws on an unlisted remote host. */}
                                <img className="avatar" src={user.avatar} alt={user.username} />
                            </Link>
                        </>
                    ) : (
                        <Link className="btn btn-primary" href="/login">Sign in</Link>
                    )}
                </div>
            </div>
        </header>
    );
}
