import mongoose, { isValidObjectId } from "mongoose";
import https from "https";
import { Video } from "../models/video.model.js";
import {
    WatchEvent,
    VIEW_THRESHOLD,
} from "../models/watchEvent.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { applyInteraction } from "../services/recommendation/tasteProfile.js";
import {
    signPlaybackUrl,
    issuePlaybackToken,
    verifyPlaybackToken,
    parseRangeHeader,
    generateMasterManifest,
} from "../services/streaming/hls.service.js";

/**
 * GET /api/v1/stream/:videoId/manifest
 *
 * What the player asks for first. Returns the HLS master playlist URL plus the
 * rendition ladder, a short-lived playback token, and the viewer's saved
 * position so playback can resume where they left off.
 */
const getPlaybackManifest = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const video = await Video.findById(videoId).select(
        "publicId hlsMasterUrl renditions duration visibility isPublished owner transcodeStatus previewSpriteUrl"
    );

    if (!video) throw new ApiError(404, "Video not found");

    if (video.transcodeStatus !== "ready") {
        throw new ApiError(409, `Video is still ${video.transcodeStatus}`);
    }

    const isOwner = String(video.owner) === String(req.user?._id);
    if (video.visibility === "private" && !isOwner) {
        throw new ApiError(403, "This video is private");
    }
    if (!video.isPublished && !isOwner) {
        throw new ApiError(404, "Video not found");
    }

    const { token, expires } = issuePlaybackToken(videoId, req.user?._id);

    // Resume point — only meaningful for signed-in viewers.
    let resumeAt = 0;
    if (req.user?._id) {
        const prior = await WatchEvent.findOne({ user: req.user._id, video: videoId })
            .select("lastPositionSeconds completed")
            .lean();
        // Don't resume within the last 15s; the viewer effectively finished it.
        if (prior && !prior.completed && prior.lastPositionSeconds < video.duration - 15) {
            resumeAt = prior.lastPositionSeconds;
        }
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videoId,
                duration: video.duration,
                masterPlaylistUrl: video.publicId
                    ? signPlaybackUrl(video.publicId)
                    : video.hlsMasterUrl,
                renditions: video.renditions,
                previewSpriteUrl: video.previewSpriteUrl,
                playbackToken: token,
                tokenExpiresAt: expires,
                resumeAt,
                segmentDuration: 6,
            },
            "Playback manifest ready"
        )
    );
});

/**
 * GET /api/v1/stream/:videoId/master.m3u8
 * Serves a real HLS master manifest as text/plain, for players that want the
 * manifest directly rather than a JSON envelope.
 */
const getMasterManifest = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { token } = req.query;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");
    if (!verifyPlaybackToken(token, videoId)) {
        throw new ApiError(401, "Invalid or expired playback token");
    }

    const video = await Video.findById(videoId).select("renditions").lean();
    if (!video) throw new ApiError(404, "Video not found");

    const manifest = generateMasterManifest(video.renditions || []);

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).send(manifest);
});

/**
 * POST /api/v1/stream/:videoId/progress
 *
 * The heartbeat. The player posts here every ~10 seconds and once on unload.
 *
 * This single endpoint does three jobs at once:
 *   1. saves the resume position
 *   2. decides whether the play has earned a "view"
 *   3. feeds the recommendation engine its most valuable signal
 *
 * Everything is upserted into one row per (user, video), so a viewer scrubbing
 * back and forth produces one honest record rather than fifty.
 */
const recordProgress = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { positionSeconds = 0, watchedSeconds = 0, source = "direct", rankPosition } = req.body;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const video = await Video.findById(videoId).select("duration tags category owner");
    if (!video) throw new ApiError(404, "Video not found");

    const duration = video.duration || 1;

    // Clamp everything — a client can send anything, and an inflated
    // watchedSeconds would poison both the view count and the ranker.
    const position = Math.max(0, Math.min(Number(positionSeconds) || 0, duration));
    const watched = Math.max(0, Math.min(Number(watchedSeconds) || 0, duration));
    const watchRatio = Math.max(0, Math.min(watched / duration, 1));
    const completed = watchRatio >= 0.9;

    const identity = req.user?._id
        ? { user: req.user._id, video: videoId }
        : { sessionId: req.sessionId || req.ip, video: videoId };

    const existing = await WatchEvent.findOne(identity).select("countedAsView watchSeconds");

    // Monotonic: a heartbeat can only ever increase total watch time, so
    // seeking backwards doesn't erase progress.
    const newWatchSeconds = Math.max(watched, existing?.watchSeconds || 0);
    const newRatio = Math.min(newWatchSeconds / duration, 1);

    const shouldCountView = !existing?.countedAsView && newRatio >= VIEW_THRESHOLD;

    const watchEvent = await WatchEvent.findOneAndUpdate(
        identity,
        {
            $set: {
                lastPositionSeconds: position,
                watchSeconds: newWatchSeconds,
                watchRatio: newRatio,
                completed,
                source,
                ...(rankPosition !== undefined ? { rankPosition } : {}),
                ...(shouldCountView ? { countedAsView: true } : {}),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (shouldCountView) {
        await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
    }

    // Only teach the taste profile from meaningful watches. Feeding it every
    // three-second bounce would make it mostly noise.
    if (req.user?._id && newRatio >= VIEW_THRESHOLD) {
        await applyInteraction(req.user._id, video, "watch", newRatio);
    } else if (req.user?._id && newRatio < 0.1 && newWatchSeconds > 3) {
        // Started, immediately abandoned — a real negative signal.
        await applyInteraction(req.user._id, video, "skip", 1);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                watchRatio: +newRatio.toFixed(3),
                countedAsView: watchEvent.countedAsView,
                completed,
            },
            "Progress recorded"
        )
    );
});

/**
 * GET /api/v1/stream/:videoId/download
 *
 * Progressive MP4 with byte-range support — the fallback for clients that
 * cannot play HLS, and the path that makes seeking work without HLS.
 *
 * The 206 Partial Content dance is the whole trick: the browser asks for a
 * byte window, we return exactly that window plus a Content-Range header, and
 * the player can jump to the middle of a 2GB file without downloading the
 * first 1GB.
 */
const streamProgressive = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { token } = req.query;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");
    if (!verifyPlaybackToken(token, videoId)) {
        throw new ApiError(401, "Invalid or expired playback token");
    }

    const video = await Video.findById(videoId).select("videoFile visibility isPublished owner");
    if (!video) throw new ApiError(404, "Video not found");

    const isOwner = String(video.owner) === String(req.user?._id);
    if ((video.visibility === "private" || !video.isPublished) && !isOwner) {
        throw new ApiError(403, "Not permitted");
    }

    // Ask the origin how big the asset is before slicing it.
    const head = await new Promise((resolve, reject) => {
        https
            .request(video.videoFile, { method: "HEAD" }, resolve)
            .on("error", reject)
            .end();
    });

    const fileSize = parseInt(head.headers["content-length"] || "0", 10);
    if (!fileSize) throw new ApiError(502, "Could not determine asset size");

    const range = parseRangeHeader(req.headers.range, fileSize);

    // No Range header: the client wants the whole thing.
    if (!range) {
        res.writeHead(200, {
            "Content-Length": fileSize,
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
        });
        return https.get(video.videoFile, (upstream) => upstream.pipe(res));
    }

    if (range.unsatisfiable) {
        res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
        return res.end();
    }

    const { start, end, contentLength } = range;

    res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
    });

    https.get(
        video.videoFile,
        { headers: { Range: `bytes=${start}-${end}` } },
        (upstream) => upstream.pipe(res)
    );
});

/**
 * POST /api/v1/stream/webhook/transcode
 * Called by the transcoding provider when a ladder finishes. Flips the video
 * from "processing" to "ready" so it can appear in feeds.
 */
const transcodeWebhook = asyncHandler(async (req, res) => {
    const { public_id, notification_type, eager } = req.body || {};

    if (!public_id) throw new ApiError(400, "Missing public_id");

    const status = notification_type === "eager" ? "ready" : "failed";

    await Video.findOneAndUpdate(
        { publicId: public_id },
        {
            $set: {
                transcodeStatus: status,
                ...(eager?.length ? { hlsMasterUrl: eager[0].secure_url } : {}),
            },
        }
    );

    return res.status(200).json(new ApiResponse(200, {}, "Webhook processed"));
});

/** GET /api/v1/stream/continue-watching */
const getContinueWatching = asyncHandler(async (req, res) => {
    const events = await WatchEvent.find({
        user: req.user._id,
        completed: false,
        watchRatio: { $gte: 0.05, $lt: 0.9 },
    })
        .sort({ updatedAt: -1 })
        .limit(20)
        .populate({
            path: "video",
            select: "title thumbnail duration owner views createdAt",
            populate: { path: "owner", select: "username fullName avatar" },
        })
        .lean();

    const items = events
        .filter((e) => e.video)
        .map((e) => ({
            ...e.video,
            resumeAt: e.lastPositionSeconds,
            progress: +e.watchRatio.toFixed(3),
        }));

    return res
        .status(200)
        .json(new ApiResponse(200, items, "Continue watching fetched"));
});

export {
    getPlaybackManifest,
    getMasterManifest,
    recordProgress,
    streamProgressive,
    transcodeWebhook,
    getContinueWatching,
};
