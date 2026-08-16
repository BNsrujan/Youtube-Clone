import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { applyInteraction } from "../services/recommendation/tasteProfile.js";

/** GET /api/v1/comments/:videoId — paginated, newest first, with like state. */
const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10, sortBy = "newest" } = req.query;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const video = await Video.findById(videoId).select("_id");
    if (!video) throw new ApiError(404, "Video not found");

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const viewerId = req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : null;

    const sort = sortBy === "top" ? { likesCount: -1, createdAt: -1 } : { createdAt: -1 };

    const pipeline = [
        { $match: { video: new mongoose.Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }],
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes",
            },
        },
        {
            $addFields: {
                owner: { $first: "$owner" },
                likesCount: { $size: "$likes" },
                isLiked: viewerId ? { $in: [viewerId, "$likes.likedBy"] } : false,
            },
        },
        { $project: { likes: 0 } },
        { $sort: sort },
    ];

    const result = await Comment.aggregatePaginate(
        Comment.aggregate(pipeline),
        { page: pageNum, limit: limitNum }
    );

    return res.status(200).json(new ApiResponse(200, result, "Comments fetched successfully"));
});

/** POST /api/v1/comments/:videoId */
const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");
    if (!content?.trim()) throw new ApiError(400, "Comment content is required");
    if (content.length > 5000) throw new ApiError(400, "Comment is too long");

    const video = await Video.findById(videoId).select("_id tags category owner");
    if (!video) throw new ApiError(404, "Video not found");

    const comment = await Comment.create({
        content: content.trim(),
        video: videoId,
        owner: req.user._id,
    });

    await Video.findByIdAndUpdate(videoId, { $inc: { commentsCount: 1 } });

    // Commenting is a stronger interest signal than a like — it costs effort.
    await applyInteraction(req.user._id, video, "comment", 1);

    const populated = await Comment.findById(comment._id).populate(
        "owner",
        "username fullName avatar"
    );

    return res.status(201).json(new ApiResponse(201, populated, "Comment added successfully"));
});

/** PATCH /api/v1/comments/c/:commentId */
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(commentId)) throw new ApiError(400, "Invalid comment id");
    if (!content?.trim()) throw new ApiError(400, "Comment content is required");

    const comment = await Comment.findById(commentId);
    if (!comment) throw new ApiError(404, "Comment not found");

    if (String(comment.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only edit your own comments");
    }

    comment.content = content.trim();
    await comment.save();

    return res.status(200).json(new ApiResponse(200, comment, "Comment updated successfully"));
});

/**
 * DELETE /api/v1/comments/c/:commentId
 * The video owner can also delete — creators need to moderate their own page.
 */
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) throw new ApiError(400, "Invalid comment id");

    const comment = await Comment.findById(commentId);
    if (!comment) throw new ApiError(404, "Comment not found");

    const video = await Video.findById(comment.video).select("owner");
    const isCommentOwner = String(comment.owner) === String(req.user._id);
    const isVideoOwner = video && String(video.owner) === String(req.user._id);

    if (!isCommentOwner && !isVideoOwner) {
        throw new ApiError(403, "Not permitted to delete this comment");
    }

    await Promise.all([
        Comment.findByIdAndDelete(commentId),
        Like.deleteMany({ comment: commentId }),
        Video.findByIdAndUpdate(comment.video, { $inc: { commentsCount: -1 } }),
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, { _id: commentId }, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
