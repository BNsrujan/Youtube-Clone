import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/api-server";
import "./globals.css";

/**
 * next/font self-hosts these at build time, so there's no render-blocking
 * request to Google and no layout shift when the webfont swaps in — worth
 * having on a page whose first paint is a video.
 */
const display = Archivo({
    subsets: ["latin"],
    weight: ["600", "700", "800"],
    variable: "--font-display",
    display: "swap",
});

const body = IBM_Plex_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    variable: "--font-body",
    display: "swap",
});

const mono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    variable: "--font-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "videotube",
    description:
        "Adaptive-bitrate video streaming with a hybrid recommendation engine you can inspect.",
};

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
        <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
            <body>
                <AuthProvider initialUser={user}>
                    <Header />
                    <main className="shell app-body">{children}</main>
                </AuthProvider>
            </body>
        </html>
    );
}
