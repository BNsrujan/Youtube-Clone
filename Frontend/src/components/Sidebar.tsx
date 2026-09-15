"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Icon, { type IconName } from "./Icon";
import {
    navSection,
    navHeading,
    navRow,
    navRowOn,
    railRow,
    railRowOn,
    railLabel,
    avatarSm,
} from "@/lib/ui";

/**
 * The guide.
 *
 * Two renderings of the same navigation: the 240px expanded list, and the
 * 72px mini-rail that replaces it when collapsed. They're separate DOM rather
 * than one list restyled, because the rail shows a different (much shorter)
 * subset — which is also how YouTube does it.
 *
 * Both are presentation only. Every entry is a plain <Link> to a route this
 * app already serves; the handful of YouTube destinations videotube has no
 * equivalent for are noted where they're declared.
 */

/**
 * `href` absent means videotube has no equivalent of that YouTube
 * destination. Those rows are still drawn — the shape of the guide is the
 * point — but they're inert spans rather than links, so nothing 404s and
 * nothing prefetches a route that was never built.
 */
interface Item {
    label: string;
    href?: string;
    icon: IconName;
}

const PRIMARY: Item[] = [
    { label: "Home", href: "/", icon: "home" },
    { label: "Shorts", icon: "shorts" },
    { label: "Subscriptions", icon: "subscriptions" },
];

const YOU: Item[] = [
    { label: "History", icon: "history" },
    { label: "Playlists", icon: "playlist" },
    { label: "Your videos", href: "/studio", icon: "videos" },
    { label: "Watch later", icon: "clock" },
    { label: "Liked videos", icon: "like" },
];

/** Explore maps onto the trending route's existing `category` parameter. */
const EXPLORE: Item[] = [
    { label: "Trending", href: "/trending", icon: "fire" },
    { label: "Music", href: "/trending?category=music", icon: "music" },
    { label: "Gaming", href: "/trending?category=gaming", icon: "gaming" },
    { label: "News", href: "/trending?category=news", icon: "news" },
    { label: "Sport", href: "/trending?category=sports", icon: "trophy" },
    { label: "Learning", href: "/trending?category=education", icon: "learning" },
];

const MORE: Item[] = [
    { label: "Upload a video", href: "/upload", icon: "upload" },
    { label: "Studio", href: "/studio", icon: "analytics" },
];

/** Matches the query string too, so the Explore rows don't all light up at once. */
function useIsActive() {
    const pathname = usePathname();
    const search = useSearchParams().toString();
    const here = search ? `${pathname}?${search}` : pathname;
    return (href: string) => href === here;
}

function Row({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
    const isActive = useIsActive();

    if (!item.href) {
        return (
            <span
                className={navRow + " text-text-dim cursor-default hover:bg-transparent"}
                aria-disabled="true"
                title="Not available in this build"
            >
                <Icon name={item.icon} />
                <span className="truncate">{item.label}</span>
            </span>
        );
    }

    const on = isActive(item.href);
    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={on ? navRowOn : navRow}
        >
            <Icon name={item.icon} />
            <span className="truncate">{item.label}</span>
        </Link>
    );
}

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const { user } = useAuth();

    return (
        <nav aria-label="Main">
            <div className={navSection}>
                {PRIMARY.map((i) => (
                    <Row key={i.label} item={i} onNavigate={onNavigate} />
                ))}
            </div>

            <div className={navSection}>
                <p className={navHeading}>You</p>
                {user && (
                    <Row
                        item={{ label: "Your channel", href: `/channel/${user.username}`, icon: "person" }}
                        onNavigate={onNavigate}
                    />
                )}
                {YOU.map((i) => (
                    <Row key={i.label} item={i} onNavigate={onNavigate} />
                ))}
            </div>

            {user ? (
                <div className={navSection}>
                    <p className={navHeading}>Subscriptions</p>
                    <Link
                        href={`/channel/${user.username}`}
                        onClick={onNavigate}
                        className={navRow}
                    >
                        <img className={avatarSm} src={user.avatar} alt="" />
                        <span className="truncate">{user.fullName || user.username}</span>
                    </Link>
                </div>
            ) : (
                <div className={navSection}>
                    <p className="px-3 text-sm text-text m-0 mb-3">
                        Sign in to like videos, comment, and subscribe.
                    </p>
                    <Link
                        href="/login"
                        onClick={onNavigate}
                        className={
                            "inline-flex items-center gap-1.5 h-9 px-3.5 ml-3 rounded-full " +
                            "border border-line-bright text-link text-sm font-medium " +
                            "transition-colors duration-100 hover:bg-[rgba(62,166,255,0.1)]"
                        }
                    >
                        <Icon name="person" size={20} />
                        Sign in
                    </Link>
                </div>
            )}

            <div className={navSection}>
                <p className={navHeading}>Explore</p>
                {EXPLORE.map((i) => (
                    <Row key={i.label} item={i} onNavigate={onNavigate} />
                ))}
            </div>

            {/* Creator tools are session-gated: both routes redirect to
                /login on the server, so showing them signed out would only
                offer a bounce. Sign-out lives in the header, not here. */}
            {user && (
                <div className={navSection}>
                    <p className={navHeading}>More from videotube</p>
                    {MORE.map((i) => (
                        <Row key={i.label} item={i} onNavigate={onNavigate} />
                    ))}
                </div>
            )}

            <p className="px-3 pt-4 text-xs text-text-faint leading-relaxed">
                videotube — adaptive-bitrate streaming with a recommendation engine you can
                inspect.
            </p>
        </nav>
    );
}

/** The 72px collapsed rail: icon over a tiny label, five entries deep. */
export function MiniRail() {
    const { user } = useAuth();
    const isActive = useIsActive();

    const items: Item[] = [
        { label: "Home", href: "/", icon: "home" },
        { label: "Shorts", icon: "shorts" },
        { label: "Subscriptions", icon: "subscriptions" },
        { label: "You", href: user ? `/channel/${user.username}` : "/login", icon: "person" },
        { label: "Trending", href: "/trending", icon: "fire" },
    ];

    return (
        <nav aria-label="Main (collapsed)">
            {items.map((i) =>
                i.href ? (
                    <Link
                        key={i.label}
                        href={i.href}
                        aria-current={isActive(i.href) ? "page" : undefined}
                        className={isActive(i.href) ? railRowOn : railRow}
                    >
                        <Icon name={i.icon} />
                        <span className={railLabel}>{i.label}</span>
                    </Link>
                ) : (
                    <span
                        key={i.label}
                        className={railRow + " text-text-dim cursor-default hover:bg-transparent"}
                        aria-disabled="true"
                        title="Not available in this build"
                    >
                        <Icon name={i.icon} />
                        <span className={railLabel}>{i.label}</span>
                    </span>
                )
            )}
        </nav>
    );
}
