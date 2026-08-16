import { Router } from "express";
import {
    getSubscribedChannels,
    getUserChannelSubscribers,
    toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";

const router = Router();

/**
 * Route semantics corrected. The original mapped GET /c/:channelId to
 * getSubscribedChannels and GET /u/:subscriberId to getUserChannelSubscribers,
 * i.e. each handler received the wrong kind of id. Now:
 *   /c/:subscriberId  -> channels this user follows
 *   /u/:channelId     -> subscribers of this channel
 */
router.route("/c/:subscriberId").get(optionalAuth, getSubscribedChannels);
router.route("/u/:channelId").get(optionalAuth, getUserChannelSubscribers);
router.route("/toggle/:channelId").post(verifyJWT, toggleSubscription);

export default router;
