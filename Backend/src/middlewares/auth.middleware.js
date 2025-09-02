import { ApiError } from "../utils/ApiError.js"; // Import custom ApiError class for standardized error handling
import { asyncHandler } from "../utils/asyncHandler.js"; // Import asyncHandler for handling asynchronous route handlers
import jwt from "jsonwebtoken"; // Import jsonwebtoken for verifying JWTs
import { User } from "../models/user.model.js"; // Import the User model for database interactions

// Middleware function to verify JWT tokens
export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        // Retrieve token from cookies or Authorization header
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            // If no token is found, throw an unauthorized error
            throw new ApiError(401, "Unauthorized request");
        }

        // Verify the token using the secret key
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // Find the user associated with the token
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            // If no user is found, throw an invalid access token error
            throw new ApiError(401, "Invalid Access Token");
        }

        req.user = user; // Attach the user object to the request for use in subsequent middleware/routes
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        // If an error occurs during verification, throw an unauthorized error
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});
