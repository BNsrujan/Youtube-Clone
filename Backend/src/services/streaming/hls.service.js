import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";
import fs from "fs";

/**
 * Adaptive bitrate delivery.
 *
 * A single MP4 is a bad way to serve video: a phone on 3G stalls, a desktop on
 * fibre gets needlessly soft picture. HLS solves this by cutting each rendition
 * into short segments and letting the *player* switch between ladder rungs
 * mid-playback based on measured throughput.
 *
 * The ladder below is a standard one. Each rung roughly halves the bitrate of
 * the one above, which is the spacing players need to make a clean switch
 * decision — rungs closer than that cause oscillation.
 */
export const RENDITION_LADDER = [
    { label: "1080p", height: 1080, bitrate: 5_000_000, audioBitrate: 192_000 },
    { label: "720p", height: 720, bitrate: 2_800_000, audioBitrate: 128_000 },
    { label: "480p", height: 480, bitrate: 1_400_000, audioBitrate: 128_000 },
    { label: "360p", height: 360, bitrate: 800_000, audioBitrate: 96_000 },
    { label: "240p", height: 240, bitrate: 400_000, audioBitrate: 64_000 },
];

/** Segment length in seconds. Shorter = faster adaptation, more requests. */
export const SEGMENT_DURATION = 6;

/**
 * Upload a source file and request the transcode ladder.
 *
 * Cloudinary's eager_async does the ffmpeg work off our servers. In a
 * self-hosted setup this same function would push a job onto a queue that an
 * ffmpeg worker drains — the interface stays identical, which is why the rest
 * of the codebase never learns which one is in use.
 */
export async function uploadAndTranscode(localPath, { folder = "videos" } = {}) {
    if (!localPath || !fs.existsSync(localPath)) {
        throw new Error("Source file not found");
    }

    // Eager transcoding pre-renders the whole ladder at upload time and is
    // billed per rendition. Cloudinary also builds the same sp_hd ladder
    // on-the-fly on first request, which costs nothing until someone actually
    // watches — a material difference on a metered plan. Eager is therefore
    // opt-in: turn it on when you want the first play to be warm.
    const eagerEnabled = process.env.CLOUDINARY_EAGER_TRANSCODE === "true";

    try {
        const result = await cloudinary.uploader.upload(localPath, {
            resource_type: "video",
            folder,
            ...(eagerEnabled
                ? {
                      // Only transcode rungs at or below the source height —
                      // upscaling burns CPU and bandwidth for a worse picture.
                      eager: RENDITION_LADDER.map((r) => ({
                          streaming_profile: `hd`,
                          format: "m3u8",
                          height: r.height,
                          bit_rate: r.bitrate,
                          crop: "limit",
                      })),
                      eager_async: true,
                      eager_notification_url: process.env.TRANSCODE_WEBHOOK_URL,
                  }
                : {}),
        });

        return {
            publicId: result.public_id,
            sourceUrl: result.secure_url,
            duration: Math.round(result.duration || 0),
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format,
        };
    } finally {
        // Always clear the temp file, success or failure.
        if (fs.existsSync(localPath)) {
            try {
                fs.unlinkSync(localPath);
            } catch {
                /* best effort */
            }
        }
    }
}

/**
 * Build the HLS master playlist URL for a transcoded asset.
 * The master lists every rendition; the player fetches it first, then picks.
 */
export function buildMasterPlaylistUrl(publicId) {
    if (!publicId) return null;
    return cloudinary.url(publicId, {
        resource_type: "video",
        streaming_profile: "hd",
        format: "m3u8",
        secure: true,
    });
}

/** Per-rendition playlist URLs, one per ladder rung the source supports. */
export function buildRenditions(publicId, sourceHeight = 1080) {
    return RENDITION_LADDER.filter((r) => r.height <= sourceHeight).map((r) => ({
        label: r.label,
        height: r.height,
        bitrate: r.bitrate,
        codec: "h264",
        playlistUrl: cloudinary.url(publicId, {
            resource_type: "video",
            format: "m3u8",
            height: r.height,
            bit_rate: r.bitrate,
            crop: "limit",
            secure: true,
        }),
    }));
}

/** Poster frame, pulled from 10% into the runtime. */
export function buildThumbnailUrl(publicId, duration = 0) {
    return cloudinary.url(publicId, {
        resource_type: "video",
        format: "jpg",
        start_offset: Math.max(1, Math.floor(duration * 0.1)),
        width: 1280,
        height: 720,
        crop: "fill",
        secure: true,
    });
}

/**
 * Storyboard sprite for scrub-bar hover previews.
 * One wide image of evenly spaced frames; the player crops it client-side, so
 * hovering the timeline costs zero extra requests after the first.
 */
export function buildPreviewSpriteUrl(publicId) {
    return cloudinary.url(publicId, {
        resource_type: "video",
        format: "jpg",
        transformation: [{ width: 160, height: 90, crop: "fill" }],
        flags: "sprite",
        secure: true,
    });
}

/**
 * Hand-written HLS master manifest.
 *
 * Only needed when serving segments from our own origin rather than a CDN that
 * generates manifests for us. Included because it makes the format concrete:
 * a master playlist is just a text file mapping bandwidth to a sub-playlist.
 */
export function generateMasterManifest(renditions, { basePath = "" } = {}) {
    const lines = ["#EXTM3U", "#EXT-X-VERSION:3", ""];

    for (const r of renditions) {
        const width = Math.round((r.height * 16) / 9);
        lines.push(
            `#EXT-X-STREAM-INF:BANDWIDTH=${r.bitrate},RESOLUTION=${width}x${r.height},CODECS="avc1.640028,mp4a.40.2"`
        );
        lines.push(`${basePath}${r.playlistUrl}`);
        lines.push("");
    }

    return lines.join("\n");
}

/**
 * Signed, expiring playback URL.
 *
 * Without this, any public video URL can be hotlinked or shared indefinitely.
 * A short TTL means a leaked link dies quickly, and private videos stay private
 * even though the storage bucket is reachable.
 */
export function signPlaybackUrl(publicId, { ttlSeconds = 3600 } = {}) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

    // `type` must match how the asset was stored. uploadAndTranscode() stores
    // with the default delivery type ("upload"), so signing an "authenticated"
    // URL produced a valid signature pointing at a path that does not exist —
    // every manifest 404'd with "Resource not found". Only assets deliberately
    // uploaded as authenticated get that path.
    const authenticated = process.env.CLOUDINARY_DELIVERY_TYPE === "authenticated";

    return cloudinary.url(publicId, {
        resource_type: "video",
        format: "m3u8",
        streaming_profile: "hd",
        secure: true,
        sign_url: true,
        ...(authenticated ? { type: "authenticated", expires_at: expiresAt } : {}),
    });
}

/**
 * HMAC token binding a playback session to one user and one video.
 * Verified on every segment request when serving from our own origin.
 */
export function issuePlaybackToken(videoId, userId, ttlSeconds = 3600) {
    const expires = Date.now() + ttlSeconds * 1000;
    const payload = `${videoId}:${userId || "anon"}:${expires}`;

    const signature = crypto
        .createHmac("sha256", process.env.PLAYBACK_TOKEN_SECRET || "dev-secret")
        .update(payload)
        .digest("hex");

    return { token: `${Buffer.from(payload).toString("base64url")}.${signature}`, expires };
}

export function verifyPlaybackToken(token, videoId) {
    if (!token || !token.includes(".")) return false;

    const [encoded, signature] = token.split(".");

    let payload;
    try {
        payload = Buffer.from(encoded, "base64url").toString("utf8");
    } catch {
        return false;
    }

    const expected = crypto
        .createHmac("sha256", process.env.PLAYBACK_TOKEN_SECRET || "dev-secret")
        .update(payload)
        .digest("hex");

    // Constant-time compare — a naive === leaks signature bytes via timing.
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

    const [tokenVideoId, , expires] = payload.split(":");
    if (String(tokenVideoId) !== String(videoId)) return false;
    if (Date.now() > Number(expires)) return false;

    return true;
}

/**
 * Parse an HTTP Range header into a concrete byte window.
 *
 * This is what makes seeking work on progressive MP4 (the fallback path when a
 * client cannot do HLS). The browser asks for "bytes=1048576-", the server
 * replies 206 Partial Content with just that slice, and playback starts from
 * the middle without downloading everything before it.
 */
export function parseRangeHeader(rangeHeader, fileSize) {
    if (!rangeHeader) return null;

    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) return null;

    const [, startRaw, endRaw] = match;

    let start = startRaw ? parseInt(startRaw, 10) : 0;
    let end = endRaw ? parseInt(endRaw, 10) : fileSize - 1;

    // Suffix form: "bytes=-500" means the last 500 bytes.
    if (!startRaw && endRaw) {
        start = Math.max(0, fileSize - parseInt(endRaw, 10));
        end = fileSize - 1;
    }

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
        return { unsatisfiable: true };
    }

    end = Math.min(end, fileSize - 1);

    // Cap the slice so one request cannot pull a whole 4K file into memory.
    const MAX_CHUNK = 2 * 1024 * 1024;
    end = Math.min(end, start + MAX_CHUNK - 1);

    return { start, end, contentLength: end - start + 1 };
}
