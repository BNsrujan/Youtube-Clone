"use client";

import { useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import SidebarNav, { MiniRail } from "./Sidebar";
import { shell, shellGuide, shellRail, shellScrim, shellMain, shellMainWatch } from "@/lib/ui";

type NavState = "auto" | "open" | "closed";

/**
 * Chrome shell: top bar, guide, mini-rail, and the content margin that keeps
 * out of their way.
 *
 * The whole thing is driven by one `data-nav` attribute on the wrapper, which
 * Tailwind's `group-data-[…]` variants read from each piece. That's on purpose:
 * width, transform, scrim and content margin are four rules that must agree
 * about the same state, and a single attribute makes disagreement impossible.
 *
 * The initial value is "auto" rather than a boolean so the server and the
 * client render identical markup — CSS alone decides that untouched means
 * "expanded on a desktop, hidden on a phone", and no state needs to be guessed
 * before hydration. Only a click on the hamburger moves it to an explicit
 * open/closed, and only then does the viewport get measured.
 *
 * `children` is passed through untouched, so pages stay Server Components
 * even though this wrapper is a client one.
 */
export default function AppShell({ children }: { children: ReactNode }) {
    const [nav, setNav] = useState<NavState>("auto");
    const pathname = usePathname();

    // YouTube keeps the guide as an overlay on the watch page at every width,
    // so the player never gives up 240px. Same here.
    const overlayOnly = pathname?.startsWith("/watch") ?? false;

    const toggle = useCallback(() => {
        setNav((current) => {
            if (current !== "auto") return current === "open" ? "closed" : "open";
            const wide =
                typeof window !== "undefined" &&
                window.matchMedia("(min-width: 1280px)").matches;
            return wide && !overlayOnly ? "closed" : "open";
        });
    }, [overlayOnly]);

    const close = useCallback(() => setNav("closed"), []);

    return (
        <div className={shell} data-nav={overlayOnly && nav === "auto" ? "closed" : nav}>
            <Header onMenuClick={toggle} />

            <aside className={overlayOnly ? shellGuide + " xl:hidden" : shellGuide}>
                <SidebarNav onNavigate={close} />
            </aside>

            {!overlayOnly && (
                <aside className={shellRail} aria-hidden={false}>
                    <MiniRail />
                </aside>
            )}

            {/* Closes the drawer on tap. Not focusable — Escape and the
                hamburger are the keyboard paths, and a tab stop here would
                sit between the header and the page content. */}
            <div className={shellScrim} onClick={close} aria-hidden="true" />

            <main className={overlayOnly ? shellMainWatch : shellMain}>{children}</main>
        </div>
    );
}
