import { Router } from "express";
import {
    getPlaybackManifest,
    getMasterManifest,
    recordProgress,
    streamProgressive,
    transcodeWebhook,
    getContinueWatching,
} from "../controllers/stream.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { progressLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

// Playback works signed-out; personalisation (resume point) needs a user.
router.route("/:videoId/manifest").get(optionalAuth, getPlaybackManifest);
router.route("/:videoId/master.m3u8").get(optionalAuth, getMasterManifest);
router.route("/:videoId/download").get(optionalAuth, streamProgressive);

router.route("/:videoId/progress").post(optionalAuth, progressLimiter, recordProgress);

router.route("/continue-watching").get(verifyJWT, getContinueWatching);

// Called by the transcoding provider, not by a browser — no JWT.
router.route("/webhook/transcode").post(transcodeWebhook);

export default router;
