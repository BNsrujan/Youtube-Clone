import mongoose, { Schema } from "mongoose";

/**
 * A user's learned content preferences — the "content-based" half of the recommender.
 *
 * Rebuilt incrementally on every meaningful watch, and fully rebuilt nightly.
 * Stored as a sparse weight map rather than a dense vector because the tag
 * vocabulary is open-ended and each user only touches a tiny slice of it.
 */
const userTasteSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },

        /**
         * tag -> affinity weight.  Map (not object) so Mongo can handle
         * arbitrary keys including ones with dots.
         *   weight = sum over watches of (watchRatio * recencyDecay)
         */
        tagWeights: {
            type: Map,
            of: Number,
            default: () => new Map(),
        },

        categoryWeights: {
            type: Map,
            of: Number,
            default: () => new Map(),
        },

        /** Channels the user reliably finishes, independent of subscription. */
        creatorWeights: {
            type: Map,
            of: Number,
            default: () => new Map(),
        },

        /**
         * Rolling count of distinct categories watched.
         * Low diversity => the ranker injects more exploration to avoid a
         * filter bubble.
         */
        diversityScore: { type: Number, default: 0, min: 0, max: 1 },

        interactionCount: { type: Number, default: 0 },
        lastRebuiltAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

/** Half-life of an interaction's influence, in days. */
export const TASTE_HALFLIFE_DAYS = 30;

/** Multiplicative decay applied to existing weights before adding a new signal. */
export function decayFactor(daysElapsed, halflife = TASTE_HALFLIFE_DAYS) {
    return Math.pow(0.5, daysElapsed / halflife);
}

/** Top-N tags by weight, as a plain sorted array. */
userTasteSchema.methods.topTags = function (n = 20) {
    return [...this.tagWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([tag, weight]) => ({ tag, weight }));
};

export const UserTaste = mongoose.model("UserTaste", userTasteSchema);
