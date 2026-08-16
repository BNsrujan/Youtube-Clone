import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { UserTaste } from "../models/userTaste.model.js";
import { WatchEvent } from "../models/watchEvent.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    generateCandidates,
    relatedCandidates,
    coldStartCandidates,
} from "../services/recommendation/candidateGeneration.js";
import { rankCandidates } from "../services/recommendation/ranker.js";
import { rebuildTasteProfile } from "../services/recommendation/tasteProfile.js";

/**
 * GET /api/v1/recommendations/feed
 * The personalised home feed — the full two-stage pipeline.
 */
const getHomeFeed = asyncHandler(async (req, res) => {
    const { limit = 20, explain = false } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const userId = req.user?._id;

    // Cold start: no signed-in user, or a user with almost no history. Fall
    // back to popularity — a generic-but-good feed beats an empty one.
    const interactionCount = userId
        ? await WatchEvent.countDocuments({ user: userId })
        : 0;

    const isColdStart = !userId || interactionCount < 3;

    const candidates = isColdStart
        ? await coldStartCandidates({ limit: limitNum * 3 })
        : await generateCandidates(userId);

    if (!candidates.length) {
        const fallback = await coldStartCandidates({ limit: limitNum });
        const ranked = await rankCandidates(fallback, { userId, limit: limitNum });
        return res.status(200).json(
            new ApiResponse(200, { items: ranked, strategy: "fallback" }, "Feed fetched")
        );
    }

    const items = await rankCandidates(candidates, {
        userId,
        limit: limitNum,
        explain: explain === "true",
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                items,
                strategy: isColdStart ? "cold_start" : "personalised",
                candidatePoolSize: candidates.length,
            },
            "Feed fetched successfully"
        )
    );
});

/**
 * GET /api/v1/recommendations/related/:videoId
 * The watch-page sidebar. Anchored on the current video rather than the user,
 * so it works for logged-out viewers too.
 */
const getRelatedVideos = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { limit = 15 } = req.query;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 30);

    const raw = await relatedCandidates(videoId, { limit: limitNum * 4 });

    // Normalise into the shape the ranker expects.
    const candidates = raw.map((c) => ({
        videoId: c.videoId,
        sourceScore: c.sourceScore,
        sources: [c.source],
    }));

    if (!candidates.length) {
        const fallback = await coldStartCandidates({ limit: limitNum });
        const ranked = await rankCandidates(fallback, {
            userId: req.user?._id,
            limit: limitNum,
        });
        return res
            .status(200)
            .json(new ApiResponse(200, ranked, "Related videos (fallback)"));
    }

    const items = await rankCandidates(candidates, {
        userId: req.user?._id,
        limit: limitNum,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, items, "Related videos fetched"));
});

/** GET /api/v1/recommendations/trending */
const getTrending = asyncHandler(async (req, res) => {
    const { limit = 20, category } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const match = {
        isPublished: true,
        visibility: "public",
        transcodeStatus: "ready",
    };
    if (category) match.category = category;

    const videos = await Video.find(match)
        .sort({ trendingScore: -1, views: -1 })
        .limit(limitNum)
        .populate("owner", "username fullName avatar")
        .select("-publicId -transcodeError")
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Trending videos fetched"));
});

/**
 * GET /api/v1/recommendations/why/:videoId
 * "Why am I seeing this?" — returns the signal breakdown for one video.
 * Worth having: a recommender you cannot interrogate is one you cannot debug.
 */
const explainRecommendation = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const [ranked] = await rankCandidates(
        [{ videoId, sourceScore: 1, sources: ["explain"] }],
        { userId: req.user._id, limit: 1, explain: true }
    );

    if (!ranked) throw new ApiError(404, "Video not found");

    const taste = await UserTaste.findOne({ user: req.user._id }).lean();
    const topTags = Object.entries(taste?.tagWeights || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, weight]) => ({ tag, weight: +weight.toFixed(3) }));

    const overlap = (ranked.tags || []).filter((t) =>
        topTags.some((tt) => tt.tag === t)
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videoId,
                title: ranked.title,
                score: ranked._recommendation.score,
                breakdown: ranked._recommendation.breakdown,
                matchedTags: overlap,
                yourTopTags: topTags,
            },
            "Explanation generated"
        )
    );
});

/** GET /api/v1/recommendations/profile — the user's own taste profile. */
const getTasteProfile = asyncHandler(async (req, res) => {
    let taste = await UserTaste.findOne({ user: req.user._id }).lean();

    if (!taste) {
        taste = await rebuildTasteProfile(req.user._id);
        taste = taste?.toObject ? taste.toObject() : taste;
    }

    const sortMap = (m) =>
        Object.entries(m || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([key, weight]) => ({ key, weight: +weight.toFixed(3) }));

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                topTags: sortMap(taste?.tagWeights),
                topCategories: sortMap(taste?.categoryWeights),
                diversityScore: +(taste?.diversityScore || 0).toFixed(3),
                interactionCount: taste?.interactionCount || 0,
                lastRebuiltAt: taste?.lastRebuiltAt,
            },
            "Taste profile fetched"
        )
    );
});

/**
 * DELETE /api/v1/recommendations/profile
 * Wipes the learned profile. Users should be able to reset a recommender that
 * has drawn the wrong conclusions about them.
 */
const resetTasteProfile = asyncHandler(async (req, res) => {
    await UserTaste.findOneAndDelete({ user: req.user._id });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Recommendation profile reset"));
});

/** POST /api/v1/recommendations/rebuild — force a rebuild from the watch log. */
const rebuildProfile = asyncHandler(async (req, res) => {
    const taste = await rebuildTasteProfile(req.user._id);

    return res.status(200).json(
        new ApiResponse(
            200,
            { interactionCount: taste?.interactionCount || 0 },
            "Profile rebuilt from watch history"
        )
    );
});

export {
    getHomeFeed,
    getRelatedVideos,
    getTrending,
    explainRecommendation,
    getTasteProfile,
    resetTasteProfile,
    rebuildProfile,
};
