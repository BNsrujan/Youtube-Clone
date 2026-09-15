"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Icon, { Logo } from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { iconBtn, avatar } from "@/lib/ui";

/**
 * The top bar. Sticky, 56px, page-coloured — it sits on the content rather
 * than floating above it, so there's no shadow and no blur.
 *
 * Three groups on one row. The outer two are `flex-1 min-w-fit`: they share
 * the leftover space equally, which is what centres the 640px search box on
 * the page rather than letting it drift with the length of the account
 * cluster — but `min-w-fit` stops them being squeezed below their own
 * contents, so at tablet widths the search shrinks instead of the logo
 * sliding under the account buttons.
 *
 * Below `md` the search box is replaced by a magnifier that expands into a
 * full-width row over the bar, which is the one piece of state this component
 * owns beyond the query itself.
 */
export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
    const { user, logout } = useAuth();
    const router = useRouter();
    const params = useSearchParams();
    const [q, setQ] = useState(params.get("q") ?? "");
    const [searchOpen, setSearchOpen] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    };

    const searchForm = (
        <form className="flex items-center gap-2 w-full" onSubmit={submit} role="search">
            <div className="flex flex-1 min-w-0">
                <input
                    className="flex-1 min-w-0 h-10 rounded-l-full border border-line-bright bg-bg px-4 text-base placeholder:text-text-faint focus:border-brand-blue focus:outline-none"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search"
                    aria-label="Search videos"
                />
                <button
                    type="submit"
                    className="grid place-items-center w-16 h-10 shrink-0 rounded-r-full border border-l-0 border-line-bright bg-surface-2 text-text transition-colors duration-100 hover:bg-surface-3"
                    aria-label="Search"
                >
                    <Icon name="search" />
                </button>
            </div>
            {/* No speech API wired up in this build; present for the layout. */}
            <button
                type="button"
                className={iconBtn + " bg-surface-2 hover:bg-surface-3"}
                title="Search with your voice"
                aria-label="Search with your voice"
            >
                <Icon name="mic" size={20} />
            </button>
        </form>
    );

    return (
        <header className="sticky top-0 z-50 h-nav bg-bg flex items-center gap-4 px-4 sm:px-6">
            {searchOpen ? (
                <div className="flex items-center gap-2 w-full md:hidden">
                    <button
                        type="button"
                        className={iconBtn}
                        onClick={() => setSearchOpen(false)}
                        aria-label="Close search"
                    >
                        <Icon name="close" size={20} />
                    </button>
                    {searchForm}
                </div>
            ) : null}

            <div className={(searchOpen ? "hidden md:flex " : "flex ") + "items-center gap-1 flex-1 min-w-fit"}>
                <button
                    type="button"
                    className={iconBtn}
                    onClick={onMenuClick}
                    aria-label="Toggle sidebar"
                >
                    <Icon name="menu" />
                </button>
                <Link href="/" aria-label="videotube" className="px-1 shrink-0">
                    <Logo />
                </Link>
            </div>

            <div className="hidden md:flex items-center justify-center flex-[0_1_640px] min-w-0">
                {searchForm}
            </div>

            <div
                className={
                    (searchOpen ? "hidden md:flex " : "flex ") +
                    "items-center gap-1 flex-1 min-w-fit justify-end"
                }
            >
                <button
                    type="button"
                    className={iconBtn + " md:hidden"}
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search"
                >
                    <Icon name="search" />
                </button>

                <ThemeToggle />

                {user ? (
                    <>
                        <Link
                            href="/upload"
                            className={iconBtn}
                            title="Create"
                            aria-label="Upload a video"
                        >
                            <Icon name="plus" />
                        </Link>
                        {/* No notifications endpoint in this build; present for the layout. */}
                        <button
                            type="button"
                            className={iconBtn + " hidden sm:grid"}
                            title="Notifications"
                            aria-label="Notifications"
                        >
                            <Icon name="bell" />
                        </button>
                        <button
                            type="button"
                            className={iconBtn + " hidden sm:grid"}
                            onClick={logout}
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <Icon name="signout" />
                        </button>
                        <Link
                            href={`/channel/${user.username}`}
                            className="ml-1 shrink-0"
                            aria-label="Your channel"
                        >
                            {/* Plain <img>: avatar hosts are deployment-configurable
                                and next/image throws on an unlisted remote host. */}
                            <img className={avatar + " w-8 h-8"} src={user.avatar} alt={user.username} />
                        </Link>
                    </>
                ) : (
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 ml-1 shrink-0 rounded-full border border-line-bright text-link text-sm font-medium transition-colors duration-100 hover:bg-[rgba(62,166,255,0.1)]"
                    >
                        <Icon name="person" size={20} />
                        Sign in
                    </Link>
                )}
            </div>
        </header>
    );
}
