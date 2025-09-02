import express from "express" // Import Express framework for creating a server
import cors from "cors" // Import CORS for handling cross-origin requests
import cookieParser from "cookie-parser" // Import cookie-parser to parse cookies

const app = express() // Initialize the Express app

// Enable CORS for specific origins and allow credentials (cookies, etc.)
app.use(cors({
    origin: process.env.CORS_ORIGIN, // Allowed origin from environment variables
    credentials: true // Allow cookies to be sent in requests
}))

// Middleware to parse incoming JSON and URL-encoded data with size limits
app.use(express.json({ limit: "16kb" })) // Set limit for JSON body size
app.use(express.urlencoded({ extended: true, limit: "16kb" })) // Set limit for URL-encoded form data

// Serve static files from the "public" directory
app.use(express.static("public"))

// Parse cookies from incoming requests
app.use(cookieParser())

// Import route handlers for different modules
import userRouter from './routes/user.routes.js'
import healthcheckRouter from "./routes/healthcheck.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"

// Register routes with their respective URL paths
app.use("/api/v1/healthcheck", healthcheckRouter) // Health check route
app.use("/api/v1/users", userRouter) // User-related routes
app.use("/api/v1/tweets", tweetRouter) // Tweet-related routes
app.use("/api/v1/subscriptions", subscriptionRouter) // Subscription-related routes
app.use("/api/v1/videos", videoRouter) // Video-related routes
app.use("/api/v1/comments", commentRouter) // Comment-related routes
app.use("/api/v1/likes", likeRouter) // Like-related routes
app.use("/api/v1/playlist", playlistRouter) // Playlist-related routes
app.use("/api/v1/dashboard", dashboardRouter) // Dashboard-related routes

export { app } // Export the Express app for use in the server
