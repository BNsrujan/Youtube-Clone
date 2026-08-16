"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { btn, btnPrimary, avatar } from "@/lib/ui";

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
        <header className="sticky top-0 z-50 bg-[rgba(14,19,25,0.92)] backdrop-blur-md border-b border-line">
            <div className="max-w-shell mx-auto px-6 max-[720px]:px-3.5 flex items-center gap-6 h-[58px] max-[720px]:gap-3">
                <Link
                    href="/"
                    className="flex items-center gap-[9px] font-display font-extrabold text-[17px] tracking-[-0.03em] shrink-0"
                >
                    <span className="w-[9px] h-[9px] rounded-full bg-live shadow-dot" aria-hidden="true" />
                    <span className="max-[720px]:hidden">videotube</span>
                </Link>

                <form className="flex-1 max-w-[520px] flex" onSubmit={submit} role="search">
                    <input
                        className="w-full bg-surface border border-line rounded-md px-[13px] py-2 text-[13px] placeholder:text-text-faint focus:border-line-bright focus:outline-none"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search videos"
                        aria-label="Search videos"
                    />
                </form>

                <div className="ml-auto flex items-center gap-[10px] shrink-0">
                    <Link className={btn} href="/trending">Trending</Link>
                    {user ? (
                        <>
                            <Link className={btn} href="/upload">Upload</Link>
                            <Link className={btn} href="/studio">Studio</Link>
                            <button className={btn} onClick={logout}>Sign out</button>
                            <Link href={`/channel/${user.username}`}>
                                {/* Plain <img>: avatar hosts are deployment-configurable
                                    and next/image throws on an unlisted remote host. */}
                                <img className={avatar} src={user.avatar} alt={user.username} />
                            </Link>
                        </>
                    ) : (
                        <Link className={btnPrimary} href="/login">Sign in</Link>
                    )}
                </div>
            </div>
        </header>
    );
}
