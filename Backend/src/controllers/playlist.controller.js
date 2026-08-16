import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/** POST /api/v1/playlist */
const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (!name?.trim()) throw new ApiError(400, "Playlist name is required");
    if (!description?.trim()) throw new ApiError(400, "Playlist description is required");

    const playlist = await Playlist.create({
        name: name.trim(),
        description: description.trim(),
        owner: req.user._id,
        videos: [],
    });

    return res.status(201).json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

/** GET /api/v1/playlist/user/:userId */
const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid user id");

    const playlists = await Playlist.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(userId) } },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videoDocs",
                pipeline: [{ $project: { thumbnail: 1, duration: 1, title: 1 } }],
            },
        },
        {
            $addFields: {
                videosCount: { $size: "$videoDocs" },
                totalDuration: { $sum: "$videoDocs.duration" },
                // Cover art is the first video's thumbnail, like YouTube does.
                coverImage: { $first: "$videoDocs.thumbnail" },
            },
        },
        { $project: { videoDocs: 0 } },
        { $sort: { updatedAt: -1 } },
    ]);

    return res.status(200).json(new ApiResponse(200, playlists, "Playlists fetched successfully"));
});

/** GET /api/v1/playlist/:playlistId */
const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    if (!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlist id");

    const [playlist] = await Playlist.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(playlistId) } },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    { $match: { isPublished: true } },
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
            $addFields: {
                owner: { $first: "$owner" },
                videosCount: { $size: "$videos" },
                totalDuration: { $sum: "$videos.duration" },
            },
        },
    ]);

    if (!playlist) throw new ApiError(404, "Playlist not found");

    return res.status(200).json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

/** PATCH /api/v1/playlist/add/:videoId/:playlistId */
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    if (!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlist id");
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const [playlist, video] = await Promise.all([
        Playlist.findById(playlistId),
        Video.findById(videoId).select("_id"),
    ]);

    if (!playlist) throw new ApiError(404, "Playlist not found");
    if (!video) throw new ApiError(404, "Video not found");

    if (String(playlist.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only modify your own playlists");
    }

    // $addToSet, not $push — adding the same video twice is a no-op.
    const updated = await Playlist.findByIdAndUpdate(
        playlistId,
        { $addToSet: { videos: videoId } },
        { new: true }
    );

    return res.status(200).json(new ApiResponse(200, updated, "Video added to playlist"));
});

/** PATCH /api/v1/playlist/remove/:videoId/:playlistId */
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    if (!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlist id");
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "Playlist not found");

    if (String(playlist.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only modify your own playlists");
    }

    const updated = await Playlist.findByIdAndUpdate(
        playlistId,
        { $pull: { videos: videoId } },
        { new: true }
    );

    return res.status(200).json(new ApiResponse(200, updated, "Video removed from playlist"));
});

/** DELETE /api/v1/playlist/:playlistId */
const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    if (!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlist id");

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "Playlist not found");

    if (String(playlist.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only delete your own playlists");
    }

    await Playlist.findByIdAndDelete(playlistId);

    return res
        .status(200)
        .json(new ApiResponse(200, { _id: playlistId }, "Playlist deleted successfully"));
});

/** PATCH /api/v1/playlist/:playlistId */
const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;

    if (!isValidObjectId(playlistId)) throw new ApiError(400, "Invalid playlist id");
    if (!name?.trim() && !description?.trim()) {
        throw new ApiError(400, "Provide a name or description to update");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "Playlist not found");

    if (String(playlist.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You can only edit your own playlists");
    }

    if (name?.trim()) playlist.name = name.trim();
    if (description?.trim()) playlist.description = description.trim();

    await playlist.save();

    return res.status(200).json(new ApiResponse(200, playlist, "Playlist updated successfully"));
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist,
};
