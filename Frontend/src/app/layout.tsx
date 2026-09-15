import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/api-server";
import "./globals.css";

/**
 * Roboto, everywhere — the reference interface's face, at 400 for body copy
 * and 500 for titles, buttons and anything that needs to sit forward.
 *
 * next/font self-hosts it at build time, so there's no render-blocking request
 * to Google and no layout shift when the webfont swaps in — worth having on a
 * page whose first paint is a wall of thumbnails.
 */
const roboto = Roboto({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
    variable: "--font-body",
    display: "swap",
});

/** Only the analytics tables and the player's telemetry strip use this. */
const robotoMono = Roboto_Mono({
    subsets: ["latin"],
    weight: ["400", "500"],
    variable: "--font-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "videotube",
    description:
        "Adaptive-bitrate video streaming with a hybrid recommendation engine you can inspect.",
};

/**
 * Applies the stored theme before the first paint.
 *
 * Dark is the default and lives on `:root`, so only an explicit light choice
 * writes an attribute. Running this synchronously in <head> is what stops a
 * light-theme user seeing a black flash on every hard navigation — a
 * useEffect would necessarily run after the browser has already painted.
 */
const THEME_SCRIPT = `try{if(localStorage.getItem('vt-theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    /**
     * Resolving the session here means the header renders signed-in on the
     * very first paint. A client-side auth check would flash "Sign in" for a
     * beat on every hard navigation.
     */
    const user = await getCurrentUser();

    return (
        <html
            lang="en"
            className={`${roboto.variable} ${robotoMono.variable}`}
            suppressHydrationWarning
        >
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
            </head>
            <body>
                <AuthProvider initialUser={user}>
                    <AppShell>{children}</AppShell>
                </AuthProvider>
            </body>
        </html>
    );
}
