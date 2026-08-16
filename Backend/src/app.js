import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";

const app = express();

// Security headers. crossOriginResourcePolicy is relaxed because video and
// thumbnail assets are served from a different origin (the CDN) than the API.
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: false,
    })
);

// gzip/brotli for JSON responses. Explicitly skipped for video, which is
// already compressed — re-compressing it burns CPU for no gain.
app.use(
    compression({
        filter: (req, res) => {
            const type = res.getHeader("Content-Type") || "";
            if (String(type).startsWith("video/")) return false;
            return compression.filter(req, res);
        },
    })
);

// A wildcard origin cannot be combined with credentials: true — browsers
// reject the pair. Parse an explicit allowlist instead.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            // No origin = same-origin request, curl, or a mobile app.
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
        credentials: true,
    })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Trust the proxy so req.ip is the real client IP behind a load balancer —
// otherwise every rate limit bucket collapses onto the proxy's address.
app.set("trust proxy", 1);

// ---- routes -------------------------------------------------------------
import userRouter from "./routes/user.routes.js";
import healthcheckRouter from "./routes/healthcheck.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import videoRouter from "./routes/video.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import streamRouter from "./routes/stream.routes.js";
import recommendationRouter from "./routes/recommendation.routes.js";

import { generalLimiter } from "./middlewares/rateLimit.middleware.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";

app.use("/api/v1", generalLimiter);

app.use("/api/v1/healthcheck", healthcheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/stream", streamRouter);
app.use("/api/v1/recommendations", recommendationRouter);

// ---- error handling -----------------------------------------------------
// Order matters: notFound catches unmatched routes, errorHandler formats
// everything. Both must come after every route registration.
app.use(notFound);
app.use(errorHandler);

export { app };
