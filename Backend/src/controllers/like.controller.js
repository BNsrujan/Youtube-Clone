import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { applyInteraction } from "../services/recommendation/tasteProfile.js";

/**
 * Shared toggle. All three like targets follow the same pattern, so the logic
 * lives once — three near-identical copies is how they drift apart.
 */
async function toggleLike({ field, targetId, userId, Model, label }) {
    if (!isValidObjectId(targetId)) throw new ApiError(400, `Invalid ${label} id`);

    const target = await Model.findById(targetId);
    if (!target) throw new ApiError(404, `${label} not found`);

    const existing = await Like.findOne({ [field]: targetId, likedBy: userId });

    if (existing) {
        await Like.findByIdAndDelete(existing._id);
        return { liked: false, target };
    }

    await Like.create({ [field]: targetId, likedBy: userId });
    return { liked: true, target };
}

/** POST /api/v1/likes/toggle/v/:videoId */
const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const { liked, target } = await toggleLike({
        field: "video",
        targetId: videoId,
        userId: req.user._id,
        Model: Video,
        label: "Video",
    });

    // Keep the denormalised counter in step with the Like collection.
    await Video.findByIdAndUpdate(videoId, { $inc: { likesCount: liked ? 1 : -1 } });

    if (liked) {
        await applyInteraction(req.user._id, target, "like", 1);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { liked }, liked ? "Video liked" : "Like removed"));
});

/** POST /api/v1/likes/toggle/c/:commentId */
const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    const { liked } = await toggleLike({
        field: "comment",
        targetId: commentId,
        userId: req.user._id,
        Model: Comment,
        label: "Comment",
    });

    return res
        .status(200)
        .json(new ApiResponse(200, { liked }, liked ? "Comment liked" : "Like removed"));
});

/** POST /api/v1/likes/toggle/t/:tweetId */
const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    const { liked } = await toggleLike({
        field: "tweet",
        targetId: tweetId,
        userId: req.user._id,
        Model: Tweet,
        label: "Tweet",
    });

    return res
        .status(200)
        .json(new ApiResponse(200, { liked }, liked ? "Tweet liked" : "Like removed"));
});

/** GET /api/v1/likes/videos */
const getLikedVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const liked = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user._id),
                video: { $exists: true, $ne: null },
            },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (pageNum - 1) * limitNum },
        { $limit: limitNum },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }],
                        },
                    },
                    { $addFields: { owner: { $first: "$owner" } } },
                    { $project: { publicId: 0, transcodeError: 0 } },
                ],
            },
        },
        { $addFields: { video: { $first: "$video" } } },
        // A liked video that has since been deleted leaves a dangling row.
        { $match: { video: { $ne: null } } },
        { $replaceRoot: { newRoot: "$video" } },
    ]);

    return res.status(200).json(new ApiResponse(200, liked, "Liked videos fetched successfully"));
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
