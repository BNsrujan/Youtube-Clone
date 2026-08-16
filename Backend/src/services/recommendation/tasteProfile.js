import { UserTaste, decayFactor } from "../../models/userTaste.model.js";
import { WatchEvent, STRONG_SIGNAL_THRESHOLD } from "../../models/watchEvent.model.js";
import { Video } from "../../models/video.model.js";

/**
 * How much each interaction type contributes to the taste profile.
 * Watch ratio dominates deliberately: a like is cheap, finishing a video is not.
 */
const SIGNAL_WEIGHTS = {
    watch: 1.0,
    like: 0.5,
    comment: 0.7,
    subscribe: 1.2,
    skip: -0.4, // started and abandoned early — a genuine negative
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Fold a single interaction into a user's taste profile.
 *
 * Called on the write path (after a watch heartbeat, a like, a subscribe) so
 * the profile stays warm without waiting for the nightly rebuild. It is
 * intentionally cheap: one findOneAndUpdate, no aggregation.
 *
 * @param {ObjectId} userId
 * @param {Object}   video    a Video doc (needs tags, category, owner)
 * @param {String}   type     key of SIGNAL_WEIGHTS
 * @param {Number}   strength 0..1 — watchRatio for watches, 1 for discrete acts
 */
export async function applyInteraction(userId, video, type, strength = 1) {
    if (!userId || !video) return null;

    const base = SIGNAL_WEIGHTS[type] ?? 0;
    if (base === 0) return null;

    const delta = base * strength;

    let taste = await UserTaste.findOne({ user: userId });
    if (!taste) {
        taste = new UserTaste({ user: userId });
    }

    // Decay everything already in the profile toward zero before adding the
    // new signal. This is what makes taste drift over time instead of being
    // permanently anchored to whatever the user watched in their first week.
    const daysSince = (Date.now() - new Date(taste.lastRebuiltAt).getTime()) / MS_PER_DAY;
    if (daysSince > 1) {
        const f = decayFactor(daysSince);
        for (const [k, v] of taste.tagWeights) taste.tagWeights.set(k, v * f);
        for (const [k, v] of taste.categoryWeights) taste.categoryWeights.set(k, v * f);
        for (const [k, v] of taste.creatorWeights) taste.creatorWeights.set(k, v * f);
        taste.lastRebuiltAt = new Date();
    }

    for (const tag of video.tags || []) {
        taste.tagWeights.set(tag, (taste.tagWeights.get(tag) || 0) + delta);
    }

    if (video.category) {
        taste.categoryWeights.set(
            video.category,
            (taste.categoryWeights.get(video.category) || 0) + delta
        );
    }

    if (video.owner) {
        const ownerKey = String(video.owner._id || video.owner);
        taste.creatorWeights.set(
            ownerKey,
            (taste.creatorWeights.get(ownerKey) || 0) + delta
        );
    }

    taste.interactionCount += 1;
    taste.diversityScore = computeDiversity(taste.categoryWeights);

    await taste.save();
    return taste;
}

/**
 * Normalised Shannon entropy over category weights, in [0,1].
 *
 * 0 => the user only ever watches one category (tight filter bubble)
 * 1 => perfectly spread across categories
 *
 * The ranker reads this to decide how much exploration to inject.
 */
function computeDiversity(categoryWeights) {
    const values = [...categoryWeights.values()].filter((v) => v > 0);
    if (values.length <= 1) return 0;

    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    const entropy = -values.reduce((acc, v) => {
        const p = v / total;
        return acc + p * Math.log(p);
    }, 0);

    return Math.min(entropy / Math.log(values.length), 1);
}

/**
 * Full rebuild from the watch log. Run nightly, and on demand when a profile
 * looks corrupted or the user asks to reset recommendations.
 *
 * Unlike applyInteraction this is authoritative — it recomputes from scratch
 * rather than accumulating, so rounding drift and bad increments get flushed.
 */
export async function rebuildTasteProfile(userId, { lookbackDays = 90 } = {}) {
    const since = new Date(Date.now() - lookbackDays * MS_PER_DAY);

    const events = await WatchEvent.find({
        user: userId,
        createdAt: { $gte: since },
        watchRatio: { $gt: 0 },
    })
        .select("video watchRatio createdAt")
        .lean();

    if (!events.length) {
        return UserTaste.findOneAndUpdate(
            { user: userId },
            { $set: { lastRebuiltAt: new Date(), interactionCount: 0 } },
            { upsert: true, new: true }
        );
    }

    const videos = await Video.find({ _id: { $in: events.map((e) => e.video) } })
        .select("tags category owner")
        .lean();

    const videoById = new Map(videos.map((v) => [String(v._id), v]));

    const tagWeights = new Map();
    const categoryWeights = new Map();
    const creatorWeights = new Map();

    for (const ev of events) {
        const video = videoById.get(String(ev.video));
        if (!video) continue;

        const ageDays = (Date.now() - new Date(ev.createdAt).getTime()) / MS_PER_DAY;
        const recency = decayFactor(ageDays);

        // Abandoned plays contribute a negative signal rather than nothing.
        const signal =
            ev.watchRatio >= STRONG_SIGNAL_THRESHOLD
                ? ev.watchRatio
                : ev.watchRatio < 0.1
                  ? SIGNAL_WEIGHTS.skip
                  : ev.watchRatio * 0.5;

        const delta = signal * recency;

        for (const tag of video.tags || []) {
            tagWeights.set(tag, (tagWeights.get(tag) || 0) + delta);
        }
        if (video.category) {
            categoryWeights.set(
                video.category,
                (categoryWeights.get(video.category) || 0) + delta
            );
        }
        if (video.owner) {
            const k = String(video.owner);
            creatorWeights.set(k, (creatorWeights.get(k) || 0) + delta);
        }
    }

    // Drop negative and near-zero weights so the map stays small.
    const prune = (m) =>
        new Map([...m.entries()].filter(([, v]) => v > 0.01).sort((a, b) => b[1] - a[1]).slice(0, 200));

    const pruned = prune(tagWeights);

    return UserTaste.findOneAndUpdate(
        { user: userId },
        {
            $set: {
                tagWeights: pruned,
                categoryWeights: prune(categoryWeights),
                creatorWeights: prune(creatorWeights),
                diversityScore: computeDiversity(prune(categoryWeights)),
                interactionCount: events.length,
                lastRebuiltAt: new Date(),
            },
        },
        { upsert: true, new: true }
    );
}

/**
 * Cosine similarity between a user's tag profile and a video's tags.
 * The video side is binary (tag present / absent), so this reduces to
 * sum of matched weights normalised by both magnitudes.
 */
export function contentAffinity(taste, video) {
    if (!taste || !video?.tags?.length) return 0;

    const weights = taste.tagWeights instanceof Map
        ? taste.tagWeights
        : new Map(Object.entries(taste.tagWeights || {}));

    if (weights.size === 0) return 0;

    let dot = 0;
    for (const tag of video.tags) {
        dot += weights.get(tag) || 0;
    }
    if (dot === 0) return 0;

    let userMag = 0;
    for (const v of weights.values()) userMag += v * v;
    userMag = Math.sqrt(userMag);

    const videoMag = Math.sqrt(video.tags.length);

    if (userMag === 0 || videoMag === 0) return 0;
    return Math.max(0, Math.min(dot / (userMag * videoMag), 1));
}
