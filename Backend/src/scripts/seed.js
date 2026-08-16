/**
 * Development seed.
 *
 * The recommendation engine cannot be evaluated on an empty database — with no
 * watch history there are no co-watch pairs, no taste profiles, and every feed
 * falls back to cold start. This generates users, videos and a *realistic*
 * watch pattern: each synthetic user is given 1-2 preferred categories and
 * watches accordingly, which is what produces meaningful clusters.
 *
 * Run:  npm run seed
 * Then: npm run jobs      (to build the similarity matrix from the seed data)
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { WatchEvent } from "../models/watchEvent.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";

dotenv.config({ path: "./.env" });

const CATEGORIES = {
    tech: ["javascript", "react", "nodejs", "webdev", "typescript", "api"],
    education: ["tutorial", "beginner", "explained", "course", "study"],
    gaming: ["gameplay", "review", "walkthrough", "esports", "indie"],
    music: ["cover", "acoustic", "remix", "live", "production"],
    howto: ["diy", "repair", "guide", "tips", "hacks"],
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seed() {
    console.log("[seed] clearing existing data...");
    await Promise.all([
        User.deleteMany({ email: /@seed\.local$/ }),
        Video.deleteMany({ title: /^\[seed\]/ }),
        WatchEvent.deleteMany({}),
        Subscription.deleteMany({}),
        Like.deleteMany({}),
    ]);

    // ---- users ----
    console.log("[seed] creating 20 users...");
    const users = [];
    for (let i = 1; i <= 20; i++) {
        const user = await User.create({
            username: `seeduser${i}`,
            email: `user${i}@seed.local`,
            fullName: `Seed User ${i}`,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`,
            password: "Password123!",
        });
        // Each user has a bias toward 1-2 categories. This is what makes the
        // co-watch matrix produce real clusters rather than uniform noise.
        user._preferredCategories = pick(CATEGORY_KEYS, rand(1, 2));
        users.push(user);
    }

    // ---- videos ----
    console.log("[seed] creating 80 videos...");
    const videos = [];
    for (let i = 1; i <= 80; i++) {
        const category = CATEGORY_KEYS[i % CATEGORY_KEYS.length];
        const owner = users[rand(0, users.length - 1)];
        const duration = rand(120, 1800);

        const video = await Video.create({
            title: `[seed] ${category} video ${i}`,
            description: `A seeded ${category} video for testing the recommendation pipeline.`,
            videoFile: `https://example.com/seed/${i}.mp4`,
            thumbnail: `https://picsum.photos/seed/vid${i}/640/360`,
            duration,
            category,
            tags: pick(CATEGORIES[category], rand(2, 4)),
            owner: owner._id,
            transcodeStatus: "ready",
            isPublished: true,
            visibility: "public",
            createdAt: new Date(Date.now() - rand(0, 60) * 24 * 60 * 60 * 1000),
        });
        videos.push(video);
    }

    // ---- watch events ----
    console.log("[seed] generating watch history...");
    let watchCount = 0;
    for (const user of users) {
        // 70% of watches come from the user's preferred categories, 30% are
        // exploration — mirroring how real behaviour actually looks.
        const preferred = videos.filter((v) =>
            user._preferredCategories.includes(v.category)
        );
        const other = videos.filter(
            (v) => !user._preferredCategories.includes(v.category)
        );

        const toWatch = [
            ...pick(preferred, rand(8, 15)),
            ...pick(other, rand(2, 5)),
        ];

        for (const video of toWatch) {
            const isPreferred = user._preferredCategories.includes(video.category);
            // Preferred content gets watched far more thoroughly.
            const ratio = isPreferred
                ? Math.min(0.5 + Math.random() * 0.5, 1)
                : Math.random() * 0.5;

            await WatchEvent.create({
                user: user._id,
                video: video._id,
                watchSeconds: Math.round(video.duration * ratio),
                lastPositionSeconds: Math.round(video.duration * ratio),
                watchRatio: ratio,
                completed: ratio >= 0.9,
                countedAsView: ratio >= 0.3,
                source: "home",
                createdAt: new Date(Date.now() - rand(0, 45) * 24 * 60 * 60 * 1000),
            });
            watchCount++;

            if (ratio > 0.7 && Math.random() > 0.5) {
                await Like.create({ video: video._id, likedBy: user._id });
                await Video.findByIdAndUpdate(video._id, { $inc: { likesCount: 1 } });
            }
        }
    }

    // ---- subscriptions ----
    console.log("[seed] creating subscriptions...");
    for (const user of users) {
        const channels = pick(
            users.filter((u) => String(u._id) !== String(user._id)),
            rand(2, 6)
        );
        for (const channel of channels) {
            await Subscription.create({ subscriber: user._id, channel: channel._id });
        }
    }

    console.log(`
[seed] done.
  users:        ${users.length}
  videos:       ${videos.length}
  watch events: ${watchCount}

Next: npm run jobs    # builds similarity matrix + taste profiles
Login with any seeduser1..20 / Password123!
`);
}

connectDB()
    .then(async () => {
        await seed();
        await mongoose.connection.close();
        process.exit(0);
    })
    .catch((err) => {
        console.error("[seed] failed:", err);
        process.exit(1);
    });
