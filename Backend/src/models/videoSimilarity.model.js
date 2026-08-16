import mongoose, { Schema } from "mongoose";

/**
 * Precomputed item-item neighbours — the "collaborative" half of the recommender.
 *
 * Computing "people who watched X also watched Y" at request time means a
 * multi-stage aggregation over the whole watch log, which is far too slow for
 * a page load. Instead a nightly job materialises the top-N neighbours per
 * video into this collection, and the request path becomes a single indexed
 * lookup.
 *
 * This is the classic offline-compute / online-serve split.
 */
const neighbourSchema = new Schema(
    {
        video: { type: Schema.Types.ObjectId, ref: "Video", required: true },
        /** Cosine-style similarity in [0,1]. */
        score: { type: Number, required: true },
        /** How many users co-watched both. Low support => low confidence. */
        support: { type: Number, default: 0 },
    },
    { _id: false }
);

const videoSimilaritySchema = new Schema(
    {
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            required: true,
            unique: true,
            index: true,
        },
        neighbours: {
            type: [neighbourSchema],
            default: [],
        },
        computedAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
);

export const VideoSimilarity = mongoose.model("VideoSimilarity", videoSimilaritySchema);
