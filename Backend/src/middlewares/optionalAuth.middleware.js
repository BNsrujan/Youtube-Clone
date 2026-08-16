import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Attaches req.user when a valid token is present, but never rejects.
 *
 * Needed because several endpoints are strictly better when personalised yet
 * must still work signed-out: the home feed, related videos, and any public
 * watch page. verifyJWT would 401 those; this degrades gracefully instead.
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decoded?._id).select("-password -refreshToken");
        if (user) req.user = user;
    } catch {
        // An expired or malformed token on a public route is not an error —
        // the viewer is simply treated as anonymous.
    }

    return next();
});
