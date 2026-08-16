import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { WatchEvent } from "../models/watchEvent.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import {
    uploadAndTranscode,
    buildMasterPlaylistUrl,
    buildRenditions,
    buildThumbnailUrl,
    buildPreviewSpriteUrl,
} from "../services/streaming/hls.service.js";

/**
 * GET /api/v1/videos
 * The browse/search endpoint. Supports full-text query, owner filter, sorting
 * and pagination, all in one aggregation so Mongo does the work, not Node.
 */
const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query,
        sortBy = "createdAt",
        sortType = "desc",
        userId,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const match = {
        isPublished: true,
        visibility: "public",
    };

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }
        match.owner = new mongoose.Types.ObjectId(userId);
        // A creator viewing their own channel should see unpublished drafts.
        if (req.user && String(req.user._id) === String(userId)) {
            delete match.isPublished;
            delete match.visibility;
        }
    }

    if (query?.trim()) {
        match.$text = { $search: query.trim() };
    }

    const allowedSorts = ["createdAt", "views", "duration", "likesCount", "trendingScore"];
    const sortField = allowedSorts.includes(sortBy) ? sortBy : "createdAt";
    const sortOrder = sortType === "asc" ? 1 : -1;

    const pipeline = [{ $match: match }];

    // When searching, relevance leads and the requested sort breaks ties.
    if (query?.trim()) {
        pipeline.push({ $addFields: { relevance: { $meta: "textScore" } } });
        pipeline.push({ $sort: { relevance: { $meta: "textScore" }, [sortField]: sortOrder } });
    } else {
        pipeline.push({ $sort: { [sortField]: sortOrder } });
    }

    pipeline.push(
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
        {
            $project: {
                videoFile: 0,
                publicId: 0,
                transcodeError: 0,
            },
        }
    );

    const result = await Video.aggregatePaginate(
        Video.aggregate(pipeline),
        { page: pageNum, limit: limitNum }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Videos fetched successfully"));
});

/**
 * POST /api/v1/videos
 * Upload a source file, kick off the transcode ladder, create the row.
 *
 * The row is created in "processing" state and returned immediately — the
 * client gets a response in a second or two rather than waiting minutes for
 * ffmpeg. The transcode webhook flips it to "ready" later.
 */
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description, tags, category, visibility } = req.body;

    if (!title?.trim()) throw new ApiError(400, "Title is required");
    if (!description?.trim()) throw new ApiError(400, "Description is required");

    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoLocalPath) throw new ApiError(400, "Video file is required");

    const uploaded = await uploadAndTranscode(videoLocalPath);
    if (!uploaded?.publicId) {
        throw new ApiError(500, "Video upload failed");
    }

    // A creator-supplied thumbnail wins; otherwise generate a poster frame.
    let thumbnailUrl;
    if (thumbnailLocalPath) {
        const thumb = await uploadOnCloudinary(thumbnailLocalPath);
        thumbnailUrl = thumb?.url;
    }
    if (!thumbnailUrl) {
        thumbnailUrl = buildThumbnailUrl(uploaded.publicId, uploaded.duration);
    }

    const parsedTags = Array.isArray(tags)
        ? tags
        : typeof tags === "string"
          ? tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

    const video = await Video.create({
        videoFile: uploaded.sourceUrl,
        publicId: uploaded.publicId,
        hlsMasterUrl: buildMasterPlaylistUrl(uploaded.publicId),
        renditions: buildRenditions(uploaded.publicId, uploaded.height),
        thumbnail: thumbnailUrl,
        previewSpriteUrl: buildPreviewSpriteUrl(uploaded.publicId),
        duration: uploaded.duration,
        title: title.trim(),
        description: description.trim(),
        tags: parsedTags,
        category: category || "other",
        visibility: visibility || "public",
        // Cloudinary serves a playable URL immediately; the ladder fills in
        // behind it. Self-hosted ffmpeg would start at "processing".
        transcodeStatus: "ready",
        owner: req.user._id,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, video, "Video published successfully"));
});

/**
 * GET /api/v1/videos/:videoId
 * Watch-page payload: the video, its creator, and the viewer's relationship
 * to both — assembled in one aggregation rather than four round trips.
 */
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const viewerId = req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : null;

    const [video] = await Video.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers",
                        },
                    },
                    {
                        $addFields: {
                            subscribersCount: { $size: "$subscribers" },
                            isSubscribed: viewerId
                                ? { $in: [viewerId, "$subscribers.subscriber"] }
                                : false,
                        },
                    },
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                            subscribersCount: 1,
                            isSubscribed: 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
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
        { $project: { likes: 0, publicId: 0, transcodeError: 0 } },
    ]);

    if (!video) throw new ApiError(404, "Video not found");

    // Private videos are visible only to their owner.
    if (video.visibility === "private" && String(video.owner?._id) !== String(req.user?._id)) {
        throw new ApiError(403, "This video is private");
    }
    if (!video.isPublished && String(video.owner?._id) !== String(req.user?._id)) {
        throw new ApiError(404, "Video not found");
    }

    // Watch history is a set-like push — rewatching should not duplicate.
    if (req.user?._id) {
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { watchHistory: video._id },
        });
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video fetched successfully"));
});

/** PATCH /api/v1/videos/:videoId */
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description, tags, category, visibility } = req.body;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");

    if (String(video.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only edit your own videos");
    }

    if (title?.trim()) video.title = title.trim();
    if (description?.trim()) video.description = description.trim();
    if (category) video.category = category;
    if (visibility) video.visibility = visibility;

    if (tags !== undefined) {
        video.tags = Array.isArray(tags)
            ? tags
            : String(tags).split(",").map((t) => t.trim()).filter(Boolean);
    }

    const thumbnailLocalPath = req.file?.path;
    if (thumbnailLocalPath) {
        const thumb = await uploadOnCloudinary(thumbnailLocalPath);
        if (!thumb?.url) throw new ApiError(500, "Thumbnail upload failed");
        video.thumbnail = thumb.url;
    }

    await video.save();

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video updated successfully"));
});

/**
 * DELETE /api/v1/videos/:videoId
 * Removes the row, the stored asset, and every dependent record. Skipping the
 * cascade is how you end up with orphaned likes pointing at nothing.
 */
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");

    if (String(video.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only delete your own videos");
    }

    if (video.publicId) {
        await deleteFromCloudinary(video.publicId, "video");
    }

    await Promise.all([
        Video.findByIdAndDelete(videoId),
        Like.deleteMany({ video: videoId }),
        Comment.deleteMany({ video: videoId }),
        WatchEvent.deleteMany({ video: videoId }),
        User.updateMany({ watchHistory: videoId }, { $pull: { watchHistory: videoId } }),
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, { _id: videoId }, "Video deleted successfully"));
});

/** PATCH /api/v1/videos/toggle/publish/:videoId */
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");

    if (String(video.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only modify your own videos");
    }

    video.isPublished = !video.isPublished;
    await video.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(
            200,
            { _id: video._id, isPublished: video.isPublished },
            `Video ${video.isPublished ? "published" : "unpublished"}`
        )
    );
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};
