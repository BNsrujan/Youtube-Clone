"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { iconBtn } from "@/lib/ui";

const KEY = "vt-theme";

/**
 * Light/dark switch.
 *
 * Dark is the default — it's what the app shipped with — so light is stored as
 * an explicit `data-theme="light"` on <html> and nothing else is persisted.
 * The attribute is applied by the inline script in layout.tsx before first
 * paint; this component only flips it afterwards.
 *
 * `mounted` guards the icon: the server can't know which theme is stored, so
 * it renders the dark-mode icon and swaps after hydration rather than risking
 * a mismatch.
 */
export default function ThemeToggle() {
    const [light, setLight] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setLight(document.documentElement.dataset.theme === "light");
        setMounted(true);
    }, []);

    const flip = () => {
        const next = !light;
        setLight(next);
        const root = document.documentElement;
        if (next) root.dataset.theme = "light";
        else delete root.dataset.theme;
        try {
            localStorage.setItem(KEY, next ? "light" : "dark");
        } catch {
            // Private mode or blocked storage — the toggle still works for
            // this page view, it just won't be remembered.
        }
    };

    return (
        <button
            type="button"
            className={iconBtn}
            onClick={flip}
            aria-pressed={mounted ? light : undefined}
            title={light ? "Switch to dark theme" : "Switch to light theme"}
            aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
        >
            <Icon name={mounted && light ? "moon" : "sun"} />
        </button>
    );
}
