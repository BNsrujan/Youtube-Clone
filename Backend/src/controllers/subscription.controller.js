import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { applyInteraction } from "../services/recommendation/tasteProfile.js";

/** POST /api/v1/subscriptions/c/:channelId */
const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel id");

    if (String(channelId) === String(req.user._id)) {
        throw new ApiError(400, "You cannot subscribe to your own channel");
    }

    const channel = await User.findById(channelId).select("_id");
    if (!channel) throw new ApiError(404, "Channel not found");

    const existing = await Subscription.findOne({
        subscriber: req.user._id,
        channel: channelId,
    });

    if (existing) {
        await Subscription.findByIdAndDelete(existing._id);
        return res
            .status(200)
            .json(new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully"));
    }

    await Subscription.create({ subscriber: req.user._id, channel: channelId });

    // Subscribing is the strongest explicit creator signal there is, so it
    // feeds straight into the taste profile's creator weights.
    const recent = await Video.findOne({ owner: channelId })
        .sort({ createdAt: -1 })
        .select("tags category owner");
    if (recent) {
        await applyInteraction(req.user._id, recent, "subscribe", 1);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { subscribed: true }, "Subscribed successfully"));
});

/** GET /api/v1/subscriptions/u/:channelId — who subscribes to this channel. */
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel id");

    const subscribers = await Subscription.aggregate([
        { $match: { channel: new mongoose.Types.ObjectId(channelId) } },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "theirSubscribers",
                        },
                    },
                    {
                        $addFields: {
                            subscribersCount: { $size: "$theirSubscribers" },
                        },
                    },
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                            subscribersCount: 1,
                        },
                    },
                ],
            },
        },
        { $addFields: { subscriber: { $first: "$subscriber" } } },
        { $replaceRoot: { newRoot: "$subscriber" } },
        { $sort: { subscribersCount: -1 } },
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            { subscribers, count: subscribers.length },
            "Subscribers fetched successfully"
        )
    );
});

/** GET /api/v1/subscriptions/c/:subscriberId — channels this user follows. */
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    if (!isValidObjectId(subscriberId)) throw new ApiError(400, "Invalid subscriber id");

    const channels = await Subscription.aggregate([
        { $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) } },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
                pipeline: [
                    {
                        $lookup: {
                            from: "videos",
                            localField: "_id",
                            foreignField: "owner",
                            as: "videos",
                            pipeline: [
                                { $match: { isPublished: true } },
                                { $sort: { createdAt: -1 } },
                                { $limit: 1 },
                                { $project: { title: 1, thumbnail: 1, createdAt: 1 } },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            latestVideo: { $first: "$videos" },
                        },
                    },
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                            latestVideo: 1,
                        },
                    },
                ],
            },
        },
        { $addFields: { channel: { $first: "$channel" } } },
        { $replaceRoot: { newRoot: "$channel" } },
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            { channels, count: channels.length },
            "Subscribed channels fetched successfully"
        )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
