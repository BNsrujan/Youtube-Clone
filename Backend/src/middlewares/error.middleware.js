import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

/**
 * Global error handler.
 *
 * This was the single biggest gap in the original codebase: asyncHandler
 * dutifully forwards every thrown ApiError to next(), but with no error
 * middleware registered, Express fell through to its default handler and
 * returned an HTML stack trace with a 500. Every carefully-chosen 404 and 403
 * in the controllers was being flattened into "500 Internal Server Error",
 * and in production the stack trace leaked to the client.
 *
 * Must be registered LAST in app.js, after all routes, and must take four
 * arguments — Express identifies error middleware by arity.
 */
const errorHandler = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof ApiError)) {
        const statusCode =
            error.statusCode || (error instanceof mongoose.Error ? 400 : 500);
        const message = error.message || "Something went wrong";
        error = new ApiError(statusCode, message, error?.errors || [], err.stack);
    }

    // Translate common driver/ODM errors into useful client messages.
    if (err instanceof mongoose.Error.ValidationError) {
        error = new ApiError(
            400,
            "Validation failed",
            Object.values(err.errors).map((e) => e.message)
        );
    }

    if (err instanceof mongoose.Error.CastError) {
        error = new ApiError(400, `Invalid ${err.path}: ${err.value}`);
    }

    // Duplicate key — surfaces as a readable "username already taken".
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || "field";
        error = new ApiError(409, `An account with that ${field} already exists`);
    }

    if (err.name === "JsonWebTokenError") error = new ApiError(401, "Invalid token");
    if (err.name === "TokenExpiredError") error = new ApiError(401, "Token expired");
    if (err.code === "LIMIT_FILE_SIZE") error = new ApiError(413, "File is too large");

    const isDev = process.env.NODE_ENV !== "production";

    if (error.statusCode >= 500) {
        console.error("[error]", req.method, req.originalUrl, error.message, error.stack);
    }

    return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        success: false,
        message: error.message,
        errors: error.errors?.length ? error.errors : undefined,
        // Stack traces never go to clients in production.
        ...(isDev ? { stack: error.stack } : {}),
    });
};

/** 404 for unmatched routes — otherwise Express returns its own HTML page. */
const notFound = (req, res, next) => {
    next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
};

export { errorHandler, notFound };
