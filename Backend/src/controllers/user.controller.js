import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

// Function to generate both access and refresh tokens for a user
const generateAccessAndRefereshTokens = async (userId) => {
    try {
        // Find the user by their ID
        const user = await User.findById(userId)

        // Generate new access and refresh tokens using user-defined methods
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // Save the new refresh token to the user document and skip validations
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        // Return both tokens
        return { accessToken, refreshToken }

    } catch (error) {
        // Throw an API error if token generation fails
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}


// Register a new user function
const registerUser = asyncHandler(async (req, res) => {
    // Destructure user input from the request body
    const { fullName, email, username, password } = req.body

    // Validate if all fields are present
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // Check if a user with the same username or email already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // Get the local paths of the avatar and cover image files (if any)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // Ensure an avatar is uploaded
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // Upload avatar and cover image to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // Ensure avatar upload was successful
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    // Create a new user in the database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",  // Cover image is optional
        email,
        password,
        username: username.toLowerCase()   // Username is saved in lowercase
    })

    // Retrieve the created user and exclude sensitive fields like password and refresh token
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // If the user is not found, throw an error
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // Return a success response with the created user
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
})

// Function to login the user
const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body

    // Ensure either username or email is provided
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    // Find the user by username or email
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    // Check if the password is correct
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

    // Retrieve logged-in user details without sensitive info
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    // Return response with tokens and user data, and set cookies
    return res
        .cookie("refreshToken", refreshToken, options)
        .status(200)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )
})

// Function to log out the user
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // Removes the refreshToken field from the user's document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    // Clear cookies and send success response
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))
})

// Function to refresh the access token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        // Verify the refresh token
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        // Find the user by ID decoded from the token
        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        // Check if the refresh token matches the user's current one
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        // Generate new access and refresh tokens
        const { accessToken, newRefreshToken } = await generateAccessAndRefereshTokens(user._id)

        // Set new tokens as cookies and return them
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            )
    } catch (error) {
        // Handle errors during token refresh
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

// Function to change the user's password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    // Find the user by their ID
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    // Update the user's password and save it without validation
    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    // Send success response after password change
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
})

// Get current user profile details
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200) // HTTP status code 200 for success
        .json(new ApiResponse(200, req.user, "User fetched successfully")) // Sends user data stored in req.user (assumed to be populated by authentication middleware) as a response
})

// Update the user's account details
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body // Extracts fullName and email from request body

    // Check if fullName and email are provided
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required") // Throws error if any required field is missing
    }

    // Find the user by their ID and update their details (fullName and email)
    const user = await User.findByIdAndUpdate(
        req.user?._id, // Retrieves user ID from authenticated request
        {
            $set: {
                fullName, // Updates fullName and email fields in the database
                email: email
            }
        },
        { new: true } // Ensures the updated user data is returned
    ).select("-password") // Excludes password field from the returned user object

    // Return a success response with the updated user details
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))
});

// Update the user's avatar (profile picture)
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path // Extracts the file path of the uploaded avatar

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing") // Throws error if avatar file is missing
    }

    // TODO: delete old avatar image from Cloudinary (assignment hint for future enhancement)

    const avatar = await uploadOnCloudinary(avatarLocalPath) // Uploads the new avatar to Cloudinary

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar") // Throws error if uploading to Cloudinary fails
    }

    // Update the user's avatar in the database
    const user = await User.findByIdAndUpdate(
        req.user?._id, // Retrieves the authenticated user ID
        {
            $set: {
                avatar: avatar.url // Updates the avatar field in the user document with the Cloudinary URL
            }
        },
        { new: true } // Ensures the updated user data is returned
    ).select("-password") // Excludes password from returned user data

    // Return a success response with the updated user details
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Avatar image updated successfully")
        )
});

// Update the user's cover image (banner image)
const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path // Extracts the file path of the uploaded cover image

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing") // Throws error if cover image file is missing
    }

    // TODO: delete old cover image from Cloudinary (assignment hint for future enhancement)

    const coverImage = await uploadOnCloudinary(coverImageLocalPath) // Uploads the new cover image to Cloudinary

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading cover image") // Throws error if uploading to Cloudinary fails
    }

    // Update the user's cover image in the database
    const user = await User.findByIdAndUpdate(
        req.user?._id, // Retrieves authenticated user ID
        {
            $set: {
                coverImage: coverImage.url // Updates the cover image field with Cloudinary URL
            }
        },
        { new: true } // Ensures the updated user data is returned
    ).select("-password") // Excludes password from returned user data

    // Return a success response with the updated user details
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Cover image updated successfully")
        )
});

// Fetch a user’s channel/profile by username
const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params // Extracts username from request parameters

    // Validate username
    if (!username?.trim()) {
        throw new ApiError(400, "username is missing") // Throws error if username is not provided
    }

    // Query to fetch user data and subscription details (number of subscribers and channels they subscribed to)
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase() // Matches username in lowercase
            }
        },
        {
            $lookup: { // Lookup the number of subscribers for the user's channel
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: { // Lookup the number of channels the user has subscribed to
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: { // Add calculated fields for subscriber count and subscription status
                subscribersCount: {
                    $size: "$subscribers" // Counts the number of subscribers
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo" // Counts the number of channels user is subscribed to
                },
                isSubscribed: { // Checks if the authenticated user is subscribed to this channel
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.r"] }, // Check if user ID exists in subscriber list
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: { // Return specific fields for the user profile
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exist") // Throws error if the channel is not found
    }

    // Return the channel profile details
    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched successfully")
        )
});

// Fetch the user's watch history (videos they have viewed)
const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id) // Match the authenticated user ID
            }
        },
        {
            $lookup: { // Lookup the videos in the user's watch history
                from: "videos",
                localField: "watchHistory", // Match videos by their IDs stored in user's watch history
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [ // Further lookup to fetch the video owner's details
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner", // Fetch the user (video owner) details by their ID
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: { // Project only necessary fields from the video owner
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner" // Selects the first element (there should be one owner per video)
                            }
                        }
                    }
                ]
            }
        }
    ])

    // Return the user's watch history
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory, // Return the user's watch history
                "Watch history fetched successfully"
            )
        )
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}