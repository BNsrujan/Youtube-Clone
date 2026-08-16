import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

/**
 * A single transcoded rendition of the source video.
 * The player picks between these based on measured bandwidth (ABR).
 */
const renditionSchema = new Schema(
    {
        label: { type: String, required: true },      // "1080p", "720p", "480p", "360p"
        height: { type: Number, required: true },
        bitrate: { type: Number, required: true },     // bits per second
        codec: { type: String, default: "h264" },
        playlistUrl: { type: String, required: true }, // per-rendition .m3u8
    },
    { _id: false }
);

const videoSchema = new Schema(
    {
        // ---- source + delivery ----------------------------------------
        videoFile: {
            type: String, // original upload URL (Cloudinary / S3)
            required: true,
        },
        publicId: {
            type: String, // provider handle, needed to delete the asset later
        },
        hlsMasterUrl: {
            type: String, // master .m3u8 that lists every rendition
        },
        renditions: {
            type: [renditionSchema],
            default: [],
        },
        thumbnail: {
            type: String,
            required: true,
        },
        previewSpriteUrl: {
            type: String, // storyboard sprite for scrub-bar hover previews
        },
        duration: {
            type: Number, // seconds
            required: true,
        },

        // ---- processing state -----------------------------------------
        // Uploads are async: the row exists before the renditions do.
        transcodeStatus: {
            type: String,
            enum: ["pending", "processing", "ready", "failed"],
            default: "pending",
            index: true,
        },
        transcodeError: { type: String },

        // ---- descriptive metadata (drives content-based recs) ---------
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        tags: {
            type: [String],
            default: [],
            set: (tags) =>
                [...new Set((tags || []).map((t) => String(t).toLowerCase().trim()))]
                    .filter(Boolean)
                    .slice(0, 25),
        },
        category: {
            type: String,
            enum: [
                "education", "music", "gaming", "news", "sports",
                "tech", "comedy", "film", "howto", "travel", "other",
            ],
            default: "other",
            index: true,
        },
        language: { type: String, default: "en" },

        // ---- visibility ------------------------------------------------
        isPublished: {
            type: Boolean,
            default: true,
        },
        visibility: {
            type: String,
            enum: ["public", "unlisted", "private"],
            default: "public",
        },

        // ---- denormalised engagement counters --------------------------
        // Kept on the document so the feed can sort without a join.
        // Source of truth stays in Like / Comment / WatchEvent.
        views: { type: Number, default: 0, min: 0 },
        likesCount: { type: Number, default: 0, min: 0 },
        commentsCount: { type: Number, default: 0, min: 0 },

        // Fraction of the video the average viewer actually watches (0..1).
        // The single strongest quality signal in the ranker.
        avgWatchRatio: { type: Number, default: 0, min: 0, max: 1 },
        totalWatchSeconds: { type: Number, default: 0, min: 0 },

        // Time-decayed popularity, recomputed by the trending job.
        trendingScore: { type: Number, default: 0, index: true },

        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

// ---- indexes ------------------------------------------------------------
// Without these every feed query is a collection scan.

// Full-text search over title/description/tags. Weighted so a title hit
// outranks a description hit.
videoSchema.index(
    { title: "text", description: "text", tags: "text" },
    { weights: { title: 10, tags: 5, description: 1 }, name: "video_search_idx" }
);

// Channel page: a creator's videos, newest first.
videoSchema.index({ owner: 1, createdAt: -1 });

// Home feed: only ready + public videos, newest first.
videoSchema.index({ isPublished: 1, visibility: 1, createdAt: -1 });

// Trending rail.
videoSchema.index({ trendingScore: -1, createdAt: -1 });

// Content-based candidate generation: "videos sharing these tags".
videoSchema.index({ tags: 1, createdAt: -1 });

// ---- helpers ------------------------------------------------------------

/** True when the asset is actually playable. */
videoSchema.methods.isPlayable = function () {
    return this.transcodeStatus === "ready" && this.isPublished;
};

/**
 * Wilson lower bound on the like ratio — a small video with 3/3 likes should
 * not outrank a large one with 900/1000. Used by the ranker.
 */
videoSchema.methods.likeConfidence = function () {
    const n = this.views || 0;
    if (n === 0) return 0;
    const p = Math.min(this.likesCount / n, 1);
    const z = 1.96;
    const denom = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
    return Math.max(0, (centre - margin) / denom);
};

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);
