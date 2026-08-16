import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { WatchEvent } from "../models/watchEvent.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * GET /api/v1/dashboard/stats
 * Creator analytics. Every figure comes from one $facet so the whole dashboard
 * is a single round trip instead of six sequential queries.
 */
const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = new mongoose.Types.ObjectId(req.user._id);

    const [videoStats] = await Video.aggregate([
        { $match: { owner: channelId } },
        {
            $facet: {
                totals: [
                    {
                        $group: {
                            _id: null,
                            totalVideos: { $sum: 1 },
                            totalViews: { $sum: "$views" },
                            totalLikes: { $sum: "$likesCount" },
                            totalComments: { $sum: "$commentsCount" },
                            totalWatchSeconds: { $sum: "$totalWatchSeconds" },
                            avgWatchRatio: { $avg: "$avgWatchRatio" },
                            published: { $sum: { $cond: ["$isPublished", 1, 0] } },
                        },
                    },
                ],
                topVideos: [
                    { $sort: { views: -1 } },
                    { $limit: 5 },
                    {
                        $project: {
                            title: 1,
                            thumbnail: 1,
                            views: 1,
                            likesCount: 1,
                            avgWatchRatio: 1,
                            createdAt: 1,
                        },
                    },
                ],
                byCategory: [
                    {
                        $group: {
                            _id: "$category",
                            count: { $sum: 1 },
                            views: { $sum: "$views" },
                        },
                    },
                    { $sort: { views: -1 } },
                ],
            },
        },
    ]);

    const totals = videoStats?.totals?.[0] || {};

    // Last 30 days of views, for the dashboard chart.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const myVideoIds = await Video.find({ owner: channelId }).distinct("_id");

    const [subscribersCount, viewsOverTime] = await Promise.all([
        Subscription.countDocuments({ channel: channelId }),
        WatchEvent.aggregate([
            {
                $match: {
                    video: { $in: myVideoIds },
                    countedAsView: true,
                    createdAt: { $gte: thirtyDaysAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    views: { $sum: 1 },
                    watchSeconds: { $sum: "$watchSeconds" },
                },
            },
            { $sort: { _id: 1 } },
        ]),
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalVideos: totals.totalVideos || 0,
                publishedVideos: totals.published || 0,
                totalViews: totals.totalViews || 0,
                totalLikes: totals.totalLikes || 0,
                totalComments: totals.totalComments || 0,
                totalSubscribers: subscribersCount,
                totalWatchHours: +((totals.totalWatchSeconds || 0) / 3600).toFixed(2),
                avgWatchRatio: +(totals.avgWatchRatio || 0).toFixed(3),
                topVideos: videoStats?.topVideos || [],
                byCategory: videoStats?.byCategory || [],
                viewsOverTime: viewsOverTime.map((d) => ({
                    date: d._id,
                    views: d.views,
                    watchHours: +(d.watchSeconds / 3600).toFixed(2),
                })),
            },
            "Channel stats fetched successfully"
        )
    );
});

/** GET /api/v1/dashboard/videos — the creator's own video list, drafts included. */
const getChannelVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, sortBy = "createdAt", sortType = "desc" } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const allowed = ["createdAt", "views", "likesCount", "duration", "avgWatchRatio"];
    const field = allowed.includes(sortBy) ? sortBy : "createdAt";
    const order = sortType === "asc" ? 1 : -1;

    const pipeline = [
        { $match: { owner: new mongoose.Types.ObjectId(req.user._id) } },
        { $sort: { [field]: order } },
        {
            $project: {
                title: 1,
                description: 1,
                thumbnail: 1,
                duration: 1,
                views: 1,
                likesCount: 1,
                commentsCount: 1,
                avgWatchRatio: 1,
                isPublished: 1,
                visibility: 1,
                transcodeStatus: 1,
                category: 1,
                tags: 1,
                createdAt: 1,
            },
        },
    ];

    const result = await Video.aggregatePaginate(
        Video.aggregate(pipeline),
        { page: pageNum, limit: limitNum }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Channel videos fetched successfully"));
});

export { getChannelStats, getChannelVideos };
