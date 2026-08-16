import mongoose from "mongoose";
import { WatchEvent } from "../models/watchEvent.model.js";
import { VideoSimilarity } from "../models/videoSimilarity.model.js";
import { Video } from "../models/video.model.js";
import { UserTaste } from "../models/userTaste.model.js";
import { rebuildTasteProfile } from "../services/recommendation/tasteProfile.js";

/**
 * Offline batch jobs.
 *
 * Everything expensive lives here rather than on the request path. The API
 * reads only precomputed collections, which is why a feed request stays in the
 * tens of milliseconds even though the underlying maths is quadratic in the
 * number of co-watches.
 *
 * Schedule these with node-cron in production, or run them manually:
 *   node src/jobs/runJobs.js similarity
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Item-item collaborative filtering.
 *
 * For each pair of videos, count users who watched both, then normalise by
 * each video's own popularity. That normalisation is what stops a viral video
 * from being "similar" to literally everything — without it, popularity alone
 * would dominate the similarity matrix.
 *
 * The formula is cosine similarity on the binary co-watch matrix:
 *     sim(A,B) = |users(A) ∩ users(B)| / sqrt(|users(A)| * |users(B)|)
 *
 * @param {Object} opts
 * @param {Number} opts.lookbackDays  only consider recent behaviour
 * @param {Number} opts.minRatio      what counts as "watched"
 * @param {Number} opts.topN          neighbours stored per video
 * @param {Number} opts.minSupport    ignore pairs with too few co-watchers
 */
export async function computeVideoSimilarity({
    lookbackDays = 60,
    minRatio = 0.3,
    topN = 50,
    minSupport = 2,
} = {}) {
    const since = new Date(Date.now() - lookbackDays * MS_PER_DAY);

    // Step 1 — build user -> [videos] lists.
    const userVideoLists = await WatchEvent.aggregate([
        {
            $match: {
                user: { $ne: null },
                watchRatio: { $gte: minRatio },
                createdAt: { $gte: since },
            },
        },
        { $group: { _id: "$user", videos: { $addToSet: "$video" } } },
        // A user who watched one video tells us nothing about pairs.
        // A user who watched 500 is probably a bot and would dominate.
        { $match: { $expr: { $and: [
            { $gte: [{ $size: "$videos" }, 2] },
            { $lte: [{ $size: "$videos" }, 300] },
        ] } } },
    ]).allowDiskUse(true);

    if (!userVideoLists.length) {
        return { pairs: 0, videos: 0, note: "no watch data in window" };
    }

    // Step 2 — popularity per video, and co-occurrence counts per pair.
    const popularity = new Map();
    const coCounts = new Map(); // "idA|idB" (sorted) -> count

    for (const { videos } of userVideoLists) {
        const ids = videos.map(String).sort();

        for (const id of ids) {
            popularity.set(id, (popularity.get(id) || 0) + 1);
        }

        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const key = `${ids[i]}|${ids[j]}`;
                coCounts.set(key, (coCounts.get(key) || 0) + 1);
            }
        }
    }

    // Step 3 — normalise into cosine similarity, keep the top N per video.
    const neighbours = new Map(); // videoId -> [{video, score, support}]

    for (const [key, count] of coCounts) {
        if (count < minSupport) continue;

        const [a, b] = key.split("|");
        const popA = popularity.get(a) || 1;
        const popB = popularity.get(b) || 1;

        const score = count / Math.sqrt(popA * popB);

        if (!neighbours.has(a)) neighbours.set(a, []);
        if (!neighbours.has(b)) neighbours.set(b, []);

        neighbours.get(a).push({ video: b, score, support: count });
        neighbours.get(b).push({ video: a, score, support: count });
    }

    // Step 4 — persist.
    const ops = [];
    for (const [videoId, list] of neighbours) {
        const top = list.sort((x, y) => y.score - x.score).slice(0, topN);

        ops.push({
            updateOne: {
                filter: { video: new mongoose.Types.ObjectId(videoId) },
                update: {
                    $set: {
                        neighbours: top.map((n) => ({
                            video: new mongoose.Types.ObjectId(n.video),
                            score: +n.score.toFixed(6),
                            support: n.support,
                        })),
                        computedAt: new Date(),
                    },
                },
                upsert: true,
            },
        });
    }

    for (let i = 0; i < ops.length; i += 500) {
        await VideoSimilarity.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }

    return {
        users: userVideoLists.length,
        pairs: coCounts.size,
        videos: neighbours.size,
    };
}

/**
 * Trending score with Reddit-style time decay.
 *
 *     score = log10(weighted engagement) + ageHours / decayHours
 *
 * The logarithm compresses runaway view counts so a 10x more popular video is
 * not 10x higher; the linear age term guarantees anything old eventually falls
 * off no matter how popular it once was.
 */
export async function computeTrendingScores({ windowHours = 72, decayHours = 12 } = {}) {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const recent = await WatchEvent.aggregate([
        { $match: { createdAt: { $gte: since }, watchRatio: { $gte: 0.3 } } },
        {
            $group: {
                _id: "$video",
                views: { $sum: 1 },
                avgRatio: { $avg: "$watchRatio" },
                completions: { $sum: { $cond: ["$completed", 1, 0] } },
            },
        },
    ]).allowDiskUse(true);

    if (!recent.length) return { updated: 0 };

    const videos = await Video.find({ _id: { $in: recent.map((r) => r._id) } })
        .select("createdAt likesCount commentsCount")
        .lean();

    const metaById = new Map(videos.map((v) => [String(v._id), v]));
    const ops = [];

    for (const row of recent) {
        const meta = metaById.get(String(row._id));
        if (!meta) continue;

        // Comments cost more effort than likes, so they weigh more.
        const engagement =
            row.views * (0.5 + row.avgRatio) +
            row.completions * 2 +
            (meta.likesCount || 0) * 1.5 +
            (meta.commentsCount || 0) * 3;

        const ageHours = (Date.now() - new Date(meta.createdAt).getTime()) / 3600000;

        const score = Math.log10(Math.max(engagement, 1)) - ageHours / decayHours;

        ops.push({
            updateOne: {
                filter: { _id: row._id },
                update: { $set: { trendingScore: +score.toFixed(6) } },
            },
        });
    }

    // Anything not in the window decays toward zero rather than sticking.
    await Video.updateMany(
        { _id: { $nin: recent.map((r) => r._id) }, trendingScore: { $gt: 0 } },
        { $mul: { trendingScore: 0.5 } }
    );

    for (let i = 0; i < ops.length; i += 500) {
        await Video.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }

    return { updated: ops.length };
}

/**
 * Recompute per-video aggregate quality metrics from the watch log.
 * Keeps the denormalised counters on Video honest.
 */
export async function refreshVideoStats() {
    const stats = await WatchEvent.aggregate([
        { $match: { countedAsView: true } },
        {
            $group: {
                _id: "$video",
                avgWatchRatio: { $avg: "$watchRatio" },
                totalWatchSeconds: { $sum: "$watchSeconds" },
                views: { $sum: 1 },
            },
        },
    ]).allowDiskUse(true);

    const ops = stats.map((s) => ({
        updateOne: {
            filter: { _id: s._id },
            update: {
                $set: {
                    avgWatchRatio: +(s.avgWatchRatio || 0).toFixed(4),
                    totalWatchSeconds: Math.round(s.totalWatchSeconds || 0),
                    views: s.views,
                },
            },
        },
    }));

    for (let i = 0; i < ops.length; i += 500) {
        await Video.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }

    return { updated: ops.length };
}

/** Nightly full rebuild of every active user's taste profile. */
export async function rebuildAllTasteProfiles({ activeSinceDays = 30 } = {}) {
    const since = new Date(Date.now() - activeSinceDays * MS_PER_DAY);

    const activeUsers = await WatchEvent.distinct("user", {
        createdAt: { $gte: since },
        user: { $ne: null },
    });

    let ok = 0;
    for (const userId of activeUsers) {
        try {
            await rebuildTasteProfile(userId);
            ok++;
        } catch (err) {
            console.error(`taste rebuild failed for ${userId}:`, err.message);
        }
    }

    return { attempted: activeUsers.length, rebuilt: ok };
}

/** Run the whole offline pipeline in dependency order. */
export async function runFullPipeline() {
    const started = Date.now();

    const statsResult = await refreshVideoStats();
    const trendingResult = await computeTrendingScores();
    const similarityResult = await computeVideoSimilarity();
    const tasteResult = await rebuildAllTasteProfiles();

    return {
        durationMs: Date.now() - started,
        stats: statsResult,
        trending: trendingResult,
        similarity: similarityResult,
        taste: tasteResult,
    };
}
