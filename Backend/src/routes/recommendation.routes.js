import { Router } from "express";
import {
    getHomeFeed,
    getRelatedVideos,
    getTrending,
    explainRecommendation,
    getTasteProfile,
    resetTasteProfile,
    rebuildProfile,
} from "../controllers/recommendation.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";

const router = Router();

// Public-but-better-signed-in: these fall back to popularity for anonymous users.
router.route("/feed").get(optionalAuth, getHomeFeed);
router.route("/related/:videoId").get(optionalAuth, getRelatedVideos);
router.route("/trending").get(optionalAuth, getTrending);

// Profile endpoints are inherently personal.
router.route("/why/:videoId").get(verifyJWT, explainRecommendation);
router.route("/profile").get(verifyJWT, getTasteProfile).delete(verifyJWT, resetTasteProfile);
router.route("/rebuild").post(verifyJWT, rebuildProfile);

export default router;
