/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,

  /**
   * Proxy /api to the Express backend so the browser only ever sees one
   * origin. That matters more here than convenience: the session lives in an
   * httpOnly cookie, and same-origin means no CORS preflight, no SameSite=None,
   * and no third-party-cookie blocking in Safari or Chrome's incognito.
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },

  /**
   * Thumbnails and avatars come from whatever storage host the deployment is
   * configured with (Cloudinary, S3, dicebear, picsum in the seed data), so
   * the set of remote hosts isn't knowable at build time. next/image throws on
   * an unconfigured host, so remote media uses plain <img> instead — see the
   * note in components/VideoCard.tsx.
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
