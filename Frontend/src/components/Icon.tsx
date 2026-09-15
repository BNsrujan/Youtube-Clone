import type { SVGProps } from "react";

/**
 * The icon set.
 *
 * Inline SVG rather than an icon package: there are ~25 glyphs in the whole
 * app, every one of them is a single path, and a dependency would cost more
 * bytes than the sprites it replaces. A Server Component, so icons in server
 * pages ship no JS.
 *
 * All paths are drawn on YouTube's 24×24 grid and filled with currentColor,
 * so an icon inherits whatever text colour its button already has — which is
 * what makes them theme-correct for free.
 */

const PATHS = {
    menu: "M21 6H3V5h18v1zm0 5H3v1h18v-1zm0 6H3v1h18v-1z",
    search:
        "M20.87 20.17l-5.59-5.59C16.35 13.35 17 11.75 17 10c0-3.87-3.13-7-7-7s-7 3.13-7 7 3.13 7 7 7c1.75 0 3.35-.65 4.58-1.71l5.59 5.59.7-.71zM10 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z",
    mic: "M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z",
    plus: "M13 11h7v2h-7v7h-2v-7H4v-2h7V4h2v7z",
    bell: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    shorts:
        "M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33c-.77-.32-1.2-.5-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z",
    subscriptions:
        "M18.7 8.7H5.3V7h13.4v1.7zm-1.7-5H7v1.7h10V3.7zm3.4 8.4v8.5c0 .9-.7 1.7-1.7 1.7H5.3c-.9 0-1.7-.7-1.7-1.7v-8.5c0-.9.7-1.7 1.7-1.7h13.4c1 0 1.7.8 1.7 1.7zm-5.1 4.2L10 13.5v5.6l5.3-2.8z",
    history:
        "M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
    playlist: "M22 7H2v1h20V7zm-9 5H2v-1h11v1zm0 4H2v-1h11v1zm2 3v-8l7 4-7 4z",
    videos: "M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-9 12V8l6 4-6 4z",
    clock: "M14.97 16.95 10 13.87V7h2v5.76l4.03 2.49-1.06 1.7zM12 3c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9m0-1c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z",
    like: "M18.77 11h-4.23l1.52-4.94C16.38 5.03 15.54 4 14.38 4c-.58 0-1.14.24-1.52.65L7 11H3v10h4h1h9.43c1.06 0 1.98-.67 2.19-1.61l1.34-6C21.23 12.15 20.18 11 18.77 11zM7 20H4v-8h3V20z",
    dislike:
        "M5.23 13h4.23l-1.52 4.94C7.62 18.97 8.46 20 9.62 20c.58 0 1.14-.24 1.52-.65L17 13h4V3h-4h-1H6.57c-1.06 0-1.98.67-2.19 1.61l-1.34 6C2.77 11.85 3.82 13 5.23 13zM17 4h3v8h-3V4z",
    share: "M15 5.63 20.66 12 15 18.37V15h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6.99c-6.1.9-9.8 4.4-11 10.51 2.98-3.99 6.5-5.5 11-5.5v7l8-9-8-9z",
    download: "M17 18v1H6v-1h11zm-.5-6.6-.7-.7-3.3 3.3V4h-1v10l-3.3-3.3-.7.7 4.5 4.5 4.5-4.5z",
    more: "M7.5 12c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm10.5-1.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm-6 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z",
    sort: "M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z",
    close: "M12.71 12l8.15 8.15-.71.71L12 12.71l-8.15 8.15-.71-.71L11.29 12 3.15 3.85l.71-.71L12 11.29l8.15-8.15.71.71L12.71 12z",
    fire: "M17.53 11.2c-.23-.3-.5-.56-.76-.82-.65-.6-1.4-1.03-2.03-1.66-1.46-1.46-1.78-3.87-.85-5.72-.93.22-1.75.75-2.45 1.32-2.56 2.07-3.57 5.72-2.36 8.86.04.1.08.2.08.33 0 .22-.15.42-.35.5-.22.1-.46.04-.64-.12-.05-.05-.1-.1-.14-.17-1.12-1.42-1.3-3.46-.54-5.1-1.67 1.37-2.58 3.68-2.45 5.85.06.5.12 1 .29 1.5.14.6.41 1.2.71 1.73 1.08 1.73 2.95 2.97 4.96 3.22 2.14.27 4.43-.12 6.07-1.6 1.83-1.67 2.47-4.33 1.53-6.62l-.13-.26c-.21-.46-.83-1.24-.83-1.24zm-3.1 6.3c-.28.24-.74.5-1.1.6-1.12.4-2.24-.16-2.9-.82 1.19-.28 1.9-1.16 2.11-2.05.17-.8-.15-1.46-.28-2.23-.12-.74-.1-1.37.17-2.06.19.38.39.76.63 1.06.77 1 1.98 1.44 2.24 2.8.04.14.06.28.06.43.03.82-.33 1.72-.93 2.27z",
    compass:
        "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z",
    music: "M12 4v9.38A3.98 3.98 0 0 0 10 13c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h5V4h-7z",
    gaming:
        "M10 8H8v2H6V8H4v6h2v-2h2v2h2V8zm9.5 2a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-2 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM22 5H2v14h20V5zm-1 13H3V6h18v12z",
    news: "M21 5H3v14h18V5zM4 6h9v6H4V6zm0 7h9v1H4v-1zm0 2h9v1H4v-1zm0 2h9v1H4v-1zm16 1h-6v-1h6v1zm0-2h-6v-1h6v1zm0-2h-6v-1h6v1zm0-2h-6V6h6v6z",
    trophy:
        "M19 4h-2V2H7v2H5a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4h.35A5 5 0 0 0 11 14.9V18H8v2h8v-2h-3v-3.1a5 5 0 0 0 3.65-2.9H17a4 4 0 0 0 4-4V6a2 2 0 0 0-2-2zM5 8V6h2v4a2 2 0 0 1-2-2zm14 0a2 2 0 0 1-2 2V6h2v2z",
    learning: "M12 3 1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z",
    upload: "M12 4 6.5 9.5l.71.71L11.5 5.9V17h1V5.9l4.29 4.31.71-.71L12 4zm-7 15v-1h14v1H5z",
    analytics: "M3 3v18h18v-2H5V3H3zm6 12h2V9H9v6zm4 0h2V6h-2v9zm4 0h2v-4h-2v4z",
    moon: "M12.3 4.9c.4-.2.6-.7.5-1.1s-.6-.8-1.1-.8c-4.9.1-8.7 4.1-8.7 9 0 5 4 9 9 9 3.8 0 7.1-2.4 8.4-5.9.2-.4 0-.9-.4-1.2-.4-.2-.9-.2-1.2.1-1 .8-2.3 1.3-3.7 1.3-3.3 0-6-2.7-6-6 0-1.9.9-3.5 2.2-4.4z",
    sun: "M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3zM11 1h2v3h-2V1zm0 19h2v3h-2v-3zM3.5 4.9l1.4-1.4 2.1 2.1-1.4 1.4L3.5 4.9zm13.5 12.5 1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zM1 11h3v2H1v-2zm19 0h3v2h-3v-2zM4.9 20.5l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1zM19.1 3.5l1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1z",
    person: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 9c4.42 0 8 1.79 8 4v3H4v-3c0-2.21 3.58-4 8-4z",
    signout: "M10 3H4v18h6v-1H5V4h5V3zm5.5 5.5-.7.7 2.3 2.3H9v1h8.1l-2.3 2.3.7.7L19 12l-3.5-3.5z",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
    name,
    size = 24,
    className = "",
    ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="currentColor"
            focusable="false"
            aria-hidden="true"
            className={"shrink-0 " + className}
            {...rest}
        >
            <path d={PATHS[name]} />
        </svg>
    );
}

/**
 * The logo mark. Deliberately videotube's own wordmark in YouTube's grammar —
 * a red rounded-rect play button beside a tight, dark wordmark — rather than a
 * copy of the YouTube logotype itself. Red appears nowhere else in the UI.
 */
export function Logo() {
    return (
        <span className="flex items-center gap-[5px]">
            <svg viewBox="0 0 28 20" width={28} height={20} aria-hidden="true" focusable="false">
                <path
                    fill="var(--brand)"
                    d="M27.4 3.1A3.5 3.5 0 0 0 24.9.6C22.7 0 14 0 14 0S5.3 0 3.1.6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9a3.5 3.5 0 0 0 2.5 2.5c2.2.6 10.9.6 10.9.6s8.7 0 10.9-.6a3.5 3.5 0 0 0 2.5-2.5c.6-2.2.6-6.9.6-6.9s0-4.7-.6-6.9z"
                />
                <path fill="#ffffff" d="M11.2 14.3 18.4 10l-7.2-4.3v8.6z" />
            </svg>
            {/* Below ~420px there isn't room for the wordmark beside the
                search and account affordances — the mark carries it alone. */}
            <span className="hidden min-[420px]:inline font-display text-[19px] font-medium tracking-[-0.02em] leading-none">
                videotube
            </span>
        </span>
    );
}
