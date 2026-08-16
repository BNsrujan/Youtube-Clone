import rateLimit from "express-rate-limit";

/**
 * Rate limits. The original API had none, which left the login endpoint open
 * to unlimited credential stuffing and the upload endpoint to trivial disk
 * exhaustion.
 */

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please slow down" },
});

/** Auth endpoints get a much tighter budget — these are the brute-force targets. */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts, try again later" },
});

export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { success: false, message: "Upload limit reached, try again later" },
});

/**
 * Progress heartbeats fire every ~10s per active viewer, so this ceiling is
 * generous — it exists to stop a script inflating watch time, not to throttle
 * normal playback.
 */
export const progressLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, message: "Too many progress updates" },
});
