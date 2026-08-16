import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const MAX_TWEET_LENGTH = 280;

/** POST /api/v1/tweets */
const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content?.trim()) throw new ApiError(400, "Tweet content is required");
    if (content.trim().length > MAX_TWEET_LENGTH) {
        throw new ApiError(400, `Tweet must be ${MAX_TWEET_LENGTH} characters or fewer`);
    }

    const tweet = await Tweet.create({
        content: content.trim(),
        owner: req.user._id,
    });

    const populated = await Tweet.findById(tweet._id).populate(
        "owner",
        "username fullName avatar"
    );

    return res.status(201).json(new ApiResponse(201, populated, "Tweet created successfully"));
});

/** GET /api/v1/tweets/user/:userId */
const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid user id");

    const user = await User.findById(userId).select("_id");
    if (!user) throw new ApiError(404, "User not found");

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const viewerId = req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : null;

    const tweets = await Tweet.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(userId) } },
        { $sort: { createdAt: -1 } },
        { $skip: (pageNum - 1) * limitNum },
        { $limit: limitNum },
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
                foreignField: "tweet",
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
    ]);

    return res.status(200).json(new ApiResponse(200, tweets, "Tweets fetched successfully"));
});

/** PATCH /api/v1/tweets/:tweetId */
const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id");
    if (!content?.trim()) throw new ApiError(400, "Tweet content is required");
    if (content.trim().length > MAX_TWEET_LENGTH) {
        throw new ApiError(400, `Tweet must be ${MAX_TWEET_LENGTH} characters or fewer`);
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) throw new ApiError(404, "Tweet not found");

    if (String(tweet.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only edit your own tweets");
    }

    tweet.content = content.trim();
    await tweet.save();

    return res.status(200).json(new ApiResponse(200, tweet, "Tweet updated successfully"));
});

/** DELETE /api/v1/tweets/:tweetId */
const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id");

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) throw new ApiError(404, "Tweet not found");

    if (String(tweet.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only delete your own tweets");
    }

    await Promise.all([
        Tweet.findByIdAndDelete(tweetId),
        Like.deleteMany({ tweet: tweetId }),
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, { _id: tweetId }, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
