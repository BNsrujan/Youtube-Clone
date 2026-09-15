import type { Config } from "tailwindcss";

/**
 * Design tokens stay defined as CSS custom properties in globals.css (not
 * hard-coded here) because lib/format.ts hands `var(--sig-content)` etc.
 * straight to inline `style` for per-row colours that Tailwind's static
 * class extraction can't express. Tailwind just wraps the same variables as
 * utilities so the two stay in sync from one source of truth.
 *
 * The radius scale maps onto YouTube's three sizes: 4px badges, 8px rail
 * thumbnails, 12px grid thumbnails and panels. Pills use `rounded-full`.
 */
const config: Config = {
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
    theme: {
        extend: {
            colors: {
                bg: "var(--bg)",
                surface: "var(--surface)",
                "surface-2": "var(--surface-2)",
                "surface-3": "var(--surface-3)",
                line: "var(--line)",
                "line-bright": "var(--line-bright)",
                text: "var(--text)",
                "text-dim": "var(--text-dim)",
                "text-faint": "var(--text-faint)",
                "invert-bg": "var(--invert-bg)",
                "invert-text": "var(--invert-text)",
                brand: "var(--brand)",
                "brand-blue": "var(--brand-blue)",
                link: "var(--link)",
                scrim: "var(--scrim)",
                badge: "var(--badge)",
                "sig-content": "var(--sig-content)",
                "sig-collab": "var(--sig-collab)",
                "sig-engagement": "var(--sig-engagement)",
                "sig-freshness": "var(--sig-freshness)",
                "sig-subscription": "var(--sig-subscription)",
                "sig-creator": "var(--sig-creator)",
                "sig-diversity": "var(--sig-diversity)",
                live: "var(--live)",
                ok: "var(--ok)",
            },
            fontFamily: {
                display: ["var(--font-display)", "Roboto", "Arial", "sans-serif"],
                body: ["var(--font-body)", "Roboto", "Arial", "sans-serif"],
                mono: ["var(--font-mono)", "ui-monospace", "monospace"],
            },
            borderRadius: {
                sm: "4px",
                DEFAULT: "8px",
                md: "8px",
                lg: "12px",
                xl: "16px",
            },
            spacing: {
                nav: "var(--nav-h)",
                sidebar: "var(--sidebar-w)",
                rail: "var(--rail-w)",
            },
            maxWidth: {
                shell: "var(--shell)",
                search: "640px",
                watch: "1280px",
            },
            keyframes: {
                "pulse-live": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.35" },
                },
                shimmer: {
                    to: { backgroundPosition: "-200% 0" },
                },
            },
            animation: {
                "pulse-live": "pulse-live 2s ease-in-out infinite",
                shimmer: "shimmer 1.4s infinite",
            },
        },
    },
    plugins: [],
};

export default config;
