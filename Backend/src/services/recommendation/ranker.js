import { Video } from "../../models/video.model.js";
import { UserTaste } from "../../models/userTaste.model.js";
import { Subscription } from "../../models/subscription.model.js";
import { contentAffinity } from "./tasteProfile.js";

/**
 * Stage 2 of the recommender: score the shortlist, then arrange it.
 *
 * Scoring is a transparent weighted sum rather than a learned model. That is a
 * deliberate choice for this project — every number below can be explained in
 * a viva, tuned by hand, and debugged by reading one log line. Swapping in a
 * gradient-boosted ranker later means replacing scoreCandidate() only; the
 * pipeline around it does not change.
 */

export const WEIGHTS = {
    contentAffinity: 0.30, // tag overlap with the user's taste profile
    collaborative: 0.25, // co-watch neighbour strength
    engagement: 0.15, // avg watch ratio + like confidence on the video itself
    freshness: 0.12, // recency decay
    subscription: 0.10, // creator the user follows
    creatorAffinity: 0.05, // creator the user finishes, follow or not
    diversityBonus: 0.03, // multi-source agreement
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Freshness decay with a 14-day half-life.
 * Sharp enough that week-old uploads still surface, slow enough that a genuinely
 * good six-month-old video is not buried.
 */
function freshnessScore(createdAt) {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / MS_PER_DAY;
    return Math.pow(0.5, ageDays / 14);
}

/**
 * How good is this video, independent of who is watching?
 * Watch ratio is weighted above likes because it is much harder to game.
 */
function engagementScore(video) {
    const watch = video.avgWatchRatio || 0;

    const views = video.views || 0;
    const likes = video.likesCount || 0;
    let likeConfidence = 0;
    if (views > 0) {
        const p = Math.min(likes / views, 1);
        const z = 1.96;
        const denom = 1 + (z * z) / views;
        const centre = p + (z * z) / (2 * views);
        const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * views)) / views);
        likeConfidence = Math.max(0, (centre - margin) / denom);
    }

    return 0.7 * watch + 0.3 * likeConfidence;
}

function scoreCandidate(candidate, video, context) {
    const { taste, subscribedSet } = context;

    const content = contentAffinity(taste, video);

    const collaborative = candidate.sources.includes("collaborative")
        ? Math.min(candidate.sourceScore, 1)
        : 0;

    const engagement = engagementScore(video);
    const freshness = freshnessScore(video.createdAt);

    const subscription = subscribedSet.has(String(video.owner)) ? 1 : 0;

    const creatorWeights = new Map(Object.entries(taste?.creatorWeights || {}));
    const rawCreator = creatorWeights.get(String(video.owner)) || 0;
    const maxCreator = Math.max(...creatorWeights.values(), 1);
    const creatorAffinity = rawCreator / maxCreator;

    // Agreement across retrieval sources.
    const uniqueSources = new Set(candidate.sources).size;
    const diversityBonus = Math.min((uniqueSources - 1) / 3, 1);

    const score =
        WEIGHTS.contentAffinity * content +
        WEIGHTS.collaborative * collaborative +
        WEIGHTS.engagement * engagement +
        WEIGHTS.freshness * freshness +
        WEIGHTS.subscription * subscription +
        WEIGHTS.creatorAffinity * creatorAffinity +
        WEIGHTS.diversityBonus * diversityBonus;

    return {
        score,
        // Kept so the API can return "why am I seeing this" and so the
        // weights can be tuned against real data later.
        breakdown: {
            content: +(WEIGHTS.contentAffinity * content).toFixed(4),
            collaborative: +(WEIGHTS.collaborative * collaborative).toFixed(4),
            engagement: +(WEIGHTS.engagement * engagement).toFixed(4),
            freshness: +(WEIGHTS.freshness * freshness).toFixed(4),
            subscription: +(WEIGHTS.subscription * subscription).toFixed(4),
            creatorAffinity: +(WEIGHTS.creatorAffinity * creatorAffinity).toFixed(4),
            diversityBonus: +(WEIGHTS.diversityBonus * diversityBonus).toFixed(4),
        },
    };
}

/**
 * Greedy re-rank for slate diversity (a simplified MMR).
 *
 * Pure score-ordering produces a feed of eight near-identical videos from two
 * creators. This walks the sorted list and applies a growing penalty each time
 * a creator or category repeats, so the top of the feed stays varied without
 * abandoning relevance.
 */
function diversify(scored, { creatorPenalty = 0.35, categoryPenalty = 0.18 } = {}) {
    const out = [];
    const creatorSeen = new Map();
    const categorySeen = new Map();

    const pool = [...scored];

    while (pool.length) {
        let bestIdx = 0;
        let bestAdjusted = -Infinity;

        for (let i = 0; i < pool.length; i++) {
            const item = pool[i];
            const c = creatorSeen.get(String(item.video.owner)) || 0;
            const g = categorySeen.get(item.video.category) || 0;

            const adjusted =
                item.score * Math.pow(1 - creatorPenalty, c) * Math.pow(1 - categoryPenalty, g);

            if (adjusted > bestAdjusted) {
                bestAdjusted = adjusted;
                bestIdx = i;
            }
        }

        const [chosen] = pool.splice(bestIdx, 1);
        chosen.adjustedScore = bestAdjusted;
        out.push(chosen);

        creatorSeen.set(
            String(chosen.video.owner),
            (creatorSeen.get(String(chosen.video.owner)) || 0) + 1
        );
        categorySeen.set(
            chosen.video.category,
            (categorySeen.get(chosen.video.category) || 0) + 1
        );
    }

    return out;
}

/**
 * Score, diversify, and hydrate a candidate pool into a ranked feed.
 *
 * @param {Array}  candidates  output of generateCandidates()
 * @param {Object} opts.userId
 * @param {Number} opts.limit
 * @param {Bool}   opts.explain  attach per-signal breakdowns
 */
export async function rankCandidates(candidates, { userId, limit = 20, explain = false } = {}) {
    if (!candidates.length) return [];

    const videoIds = candidates.map((c) => c.videoId);

    const [videos, taste, subs] = await Promise.all([
        Video.find({ _id: { $in: videoIds } })
            .populate("owner", "username fullName avatar")
            .lean(),
        userId ? UserTaste.findOne({ user: userId }).lean() : null,
        userId ? Subscription.find({ subscriber: userId }).select("channel").lean() : [],
    ]);

    const videoById = new Map(videos.map((v) => [String(v._id), v]));
    const subscribedSet = new Set((subs || []).map((s) => String(s.channel)));
    const context = { taste, subscribedSet };

    const scored = [];
    for (const candidate of candidates) {
        const video = videoById.get(candidate.videoId);
        if (!video) continue;

        const { score, breakdown } = scoreCandidate(candidate, video, context);
        scored.push({ video, score, breakdown, sources: candidate.sources });
    }

    scored.sort((a, b) => b.score - a.score);

    // Diversify a generous head of the list, not all of it — no point paying
    // the O(n^2) cost on candidates that will never be shown.
    const head = diversify(scored.slice(0, Math.max(limit * 4, 60)));
    const tail = scored.slice(Math.max(limit * 4, 60));

    return [...head, ...tail].slice(0, limit).map((item) => ({
        ...item.video,
        _recommendation: {
            score: +item.score.toFixed(4),
            sources: item.sources,
            ...(explain ? { breakdown: item.breakdown } : {}),
        },
    }));
}
