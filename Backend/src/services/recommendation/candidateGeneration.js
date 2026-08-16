import mongoose from "mongoose";
import { Video } from "../../models/video.model.js";
import { WatchEvent } from "../../models/watchEvent.model.js";
import { Subscription } from "../../models/subscription.model.js";
import { VideoSimilarity } from "../../models/videoSimilarity.model.js";
import { UserTaste } from "../../models/userTaste.model.js";

/**
 * Stage 1 of the two-stage recommender.
 *
 * Goal: reduce "every video in the catalogue" down to a few hundred plausible
 * ones, cheaply. Precision does not matter here — recall does. The expensive
 * scoring in ranker.js only ever sees this shortlist.
 *
 * Each source runs independently and in parallel, then results are merged.
 * A video surfaced by several sources at once carries that as a signal.
 */

const BASE_FILTER = {
    isPublished: true,
    visibility: "public",
    transcodeStatus: "ready",
};

/**
 * Source A — Collaborative.
 * "People who watched what you watched also watched these."
 *
 * Reads the precomputed neighbour lists rather than aggregating the watch log
 * live. Seeded from the user's most recent strong watches.
 */
async function collaborativeCandidates(userId, { seedLimit = 15, perSeed = 20 } = {}) {
    const seeds = await WatchEvent.find({
        user: userId,
        watchRatio: { $gte: 0.5 },
    })
        .sort({ updatedAt: -1 })
        .limit(seedLimit)
        .select("video watchRatio")
        .lean();

    if (!seeds.length) return [];

    const simDocs = await VideoSimilarity.find({
        video: { $in: seeds.map((s) => s.video) },
    })
        .select("video neighbours")
        .lean();

    const seedStrength = new Map(seeds.map((s) => [String(s.video), s.watchRatio]));
    const scored = new Map();

    for (const doc of simDocs) {
        const strength = seedStrength.get(String(doc.video)) || 0.5;
        for (const n of (doc.neighbours || []).slice(0, perSeed)) {
            const key = String(n.video);
            // A neighbour reachable from several seeds accumulates score.
            scored.set(key, (scored.get(key) || 0) + n.score * strength);
        }
    }

    return [...scored.entries()].map(([videoId, score]) => ({
        videoId,
        source: "collaborative",
        sourceScore: score,
    }));
}

/**
 * Source B — Content-based.
 * "More videos carrying the tags you reliably finish."
 *
 * This is what carries a brand-new user who has no co-watch neighbours yet,
 * and it is resistant to the cold-start problem on the item side too: a video
 * uploaded ten minutes ago has tags even though nobody has watched it.
 */
async function contentCandidates(userId, { limit = 120 } = {}) {
    const taste = await UserTaste.findOne({ user: userId }).lean();
    if (!taste) return [];

    const tagWeights = new Map(Object.entries(taste.tagWeights || {}));
    const topTags = [...tagWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag]) => tag);

    if (!topTags.length) return [];

    const videos = await Video.find({
        ...BASE_FILTER,
        tags: { $in: topTags },
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("_id tags")
        .lean();

    return videos.map((v) => {
        const overlap = (v.tags || []).filter((t) => topTags.includes(t)).length;
        return {
            videoId: String(v._id),
            source: "content",
            sourceScore: overlap / Math.max(topTags.length, 1),
        };
    });
}

/**
 * Source C — Subscriptions.
 * Recent uploads from channels the user follows. Nearly always relevant, so
 * these enter the pool with a high base score.
 */
async function subscriptionCandidates(userId, { limit = 60, sinceDays = 30 } = {}) {
    const subs = await Subscription.find({ subscriber: userId })
        .select("channel")
        .lean();

    if (!subs.length) return [];

    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const videos = await Video.find({
        ...BASE_FILTER,
        owner: { $in: subs.map((s) => s.channel) },
        createdAt: { $gte: since },
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("_id createdAt")
        .lean();

    return videos.map((v) => ({
        videoId: String(v._id),
        source: "subscription",
        sourceScore: 0.9,
    }));
}

/**
 * Source D — Trending.
 * Time-decayed popularity. Covers the cold-start case where we know nothing
 * about the user, and keeps the feed connected to what is actually happening.
 */
async function trendingCandidates({ limit = 50 } = {}) {
    const videos = await Video.find(BASE_FILTER)
        .sort({ trendingScore: -1 })
        .limit(limit)
        .select("_id trendingScore")
        .lean();

    const max = videos[0]?.trendingScore || 1;

    return videos.map((v) => ({
        videoId: String(v._id),
        source: "trending",
        sourceScore: max > 0 ? v.trendingScore / max : 0,
    }));
}

/**
 * Source E — Exploration.
 * A random sample of recent videos outside the user's usual categories.
 *
 * Without this the feed collapses: the ranker keeps promoting what the taste
 * profile already likes, the user watches it, the profile sharpens, and the
 * loop tightens. Exploration is the deliberate cost we pay to keep discovering
 * new interests and to give new creators any chance of being seen at all.
 */
async function explorationCandidates(userId, { limit = 30 } = {}) {
    const taste = await UserTaste.findOne({ user: userId }).lean();
    const knownCategories = Object.keys(taste?.categoryWeights || {});

    const match = { ...BASE_FILTER };
    if (knownCategories.length) {
        match.category = { $nin: knownCategories };
    }

    const videos = await Video.aggregate([
        { $match: match },
        { $sample: { size: limit } },
        { $project: { _id: 1 } },
    ]);

    return videos.map((v) => ({
        videoId: String(v._id),
        source: "exploration",
        sourceScore: 0.3,
    }));
}

/**
 * Related-video candidates for the watch page.
 * Blends co-watch neighbours with tag overlap on the currently playing video.
 */
export async function relatedCandidates(videoId, { limit = 60 } = {}) {
    const [simDoc, current] = await Promise.all([
        VideoSimilarity.findOne({ video: videoId }).select("neighbours").lean(),
        Video.findById(videoId).select("tags category owner").lean(),
    ]);

    const out = new Map();

    for (const n of (simDoc?.neighbours || []).slice(0, limit)) {
        out.set(String(n.video), {
            videoId: String(n.video),
            source: "collaborative",
            sourceScore: n.score,
        });
    }

    if (current?.tags?.length) {
        const byTag = await Video.find({
            ...BASE_FILTER,
            _id: { $ne: videoId },
            tags: { $in: current.tags },
        })
            .sort({ trendingScore: -1 })
            .limit(limit)
            .select("_id tags")
            .lean();

        for (const v of byTag) {
            const key = String(v._id);
            const overlap =
                (v.tags || []).filter((t) => current.tags.includes(t)).length /
                current.tags.length;

            const existing = out.get(key);
            if (existing) {
                existing.sourceScore += overlap * 0.5;
                existing.source = "hybrid";
            } else {
                out.set(key, { videoId: key, source: "content", sourceScore: overlap });
            }
        }
    }

    // Same-creator videos are a reliable related-rail filler.
    if (current?.owner) {
        const sameCreator = await Video.find({
            ...BASE_FILTER,
            _id: { $ne: videoId },
            owner: current.owner,
        })
            .sort({ createdAt: -1 })
            .limit(10)
            .select("_id")
            .lean();

        for (const v of sameCreator) {
            const key = String(v._id);
            if (!out.has(key)) {
                out.set(key, { videoId: key, source: "same_creator", sourceScore: 0.4 });
            }
        }
    }

    return [...out.values()];
}

/**
 * Run every source in parallel, merge, and drop anything the user has already
 * watched. Returns a deduplicated pool ready for scoring.
 */
export async function generateCandidates(userId, { excludeVideoIds = [] } = {}) {
    const [collab, content, subs, trending, explore] = await Promise.all([
        collaborativeCandidates(userId),
        contentCandidates(userId),
        subscriptionCandidates(userId),
        trendingCandidates(),
        explorationCandidates(userId),
    ]);

    // Already-watched videos never come back in the main feed.
    const watched = await WatchEvent.find({ user: userId })
        .select("video")
        .lean();

    const blocked = new Set([
        ...watched.map((w) => String(w.video)),
        ...excludeVideoIds.map(String),
    ]);

    const merged = new Map();

    for (const c of [...collab, ...content, ...subs, ...trending, ...explore]) {
        if (blocked.has(c.videoId)) continue;

        const existing = merged.get(c.videoId);
        if (existing) {
            // Surfaced by more than one retrieval path — that agreement is
            // itself evidence, so keep both the max score and the count.
            existing.sourceScore = Math.max(existing.sourceScore, c.sourceScore);
            existing.sources.push(c.source);
        } else {
            merged.set(c.videoId, {
                videoId: c.videoId,
                sourceScore: c.sourceScore,
                sources: [c.source],
            });
        }
    }

    return [...merged.values()];
}

/** Cold-start pool: no history, so popularity + freshness is all we have. */
export async function coldStartCandidates({ limit = 40 } = {}) {
    const videos = await Video.find(BASE_FILTER)
        .sort({ trendingScore: -1, createdAt: -1 })
        .limit(limit)
        .select("_id")
        .lean();

    return videos.map((v) => ({
        videoId: String(v._id),
        sourceScore: 0.5,
        sources: ["trending"],
    }));
}
