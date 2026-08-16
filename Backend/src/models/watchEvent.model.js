import mongoose, { Schema } from "mongoose";

/**
 * One row per (user, video) viewing session.
 *
 * This is the single most important collection in the project: it is the raw
 * material for BOTH halves of the recommender.
 *
 *   - collaborative filtering reads it as a user->item interaction matrix
 *   - the taste profile reads it to learn which tags a user actually finishes
 *
 * A "view" is deliberately NOT the same as an impression. We only count a view
 * once the viewer crosses a meaningful threshold, which is what stops a
 * refresh-loop from inflating counts.
 */
const watchEventSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            index: true,
            // null for logged-out viewers; sessionId carries them instead
        },
        sessionId: {
            type: String, // anonymous cookie id
            index: true,
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            required: true,
            index: true,
        },

        // ---- progress ---------------------------------------------------
        watchSeconds: { type: Number, default: 0, min: 0 },
        lastPositionSeconds: { type: Number, default: 0, min: 0 },

        /**
         * watchSeconds / video.duration, clamped to [0,1].
         * The core quality signal — a 90% completion on a 20-minute video is
         * a far stronger endorsement than a like.
         */
        watchRatio: { type: Number, default: 0, min: 0, max: 1, index: true },

        completed: { type: Boolean, default: false },

        /** Set once watchRatio crosses VIEW_THRESHOLD. Prevents double-counting. */
        countedAsView: { type: Boolean, default: false },

        // ---- attribution -------------------------------------------------
        // Lets us measure whether the recommender is actually working.
        source: {
            type: String,
            enum: ["home", "search", "related", "subscriptions", "trending", "playlist", "direct"],
            default: "direct",
            index: true,
        },
        /** Position in the rail the user clicked (for position-bias correction). */
        rankPosition: { type: Number },

        device: {
            type: String,
            enum: ["web", "mobile", "tv", "unknown"],
            default: "unknown",
        },
    },
    { timestamps: true }
);

// One live session row per user+video, upserted as progress heartbeats arrive.
watchEventSchema.index(
    { user: 1, video: 1 },
    { unique: true, partialFilterExpression: { user: { $type: "objectId" } } }
);

// Collaborative filtering scans "everything this user engaged with, recently".
watchEventSchema.index({ user: 1, watchRatio: -1, updatedAt: -1 });

// Co-watch computation scans "everyone who engaged with this video".
watchEventSchema.index({ video: 1, watchRatio: -1 });

// Trending job scans a recent time window.
watchEventSchema.index({ createdAt: -1 });

/** Below this, we treat the play as a bounce and ignore it in recs. */
export const VIEW_THRESHOLD = 0.3;

/** Above this, the view is a strong positive signal. */
export const STRONG_SIGNAL_THRESHOLD = 0.6;

export const WatchEvent = mongoose.model("WatchEvent", watchEventSchema);
