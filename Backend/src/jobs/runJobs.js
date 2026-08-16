/**
 * Job runner.
 *
 * Usage:
 *   node src/jobs/runJobs.js all         # full offline pipeline
 *   node src/jobs/runJobs.js similarity  # item-item co-watch matrix
 *   node src/jobs/runJobs.js trending
 *   node src/jobs/runJobs.js taste
 *   node src/jobs/runJobs.js stats
 *   node src/jobs/runJobs.js schedule    # stay resident, run on cron
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import connectDB from "../db/index.js";
import {
    computeVideoSimilarity,
    computeTrendingScores,
    rebuildAllTasteProfiles,
    refreshVideoStats,
    runFullPipeline,
} from "./recommendation.jobs.js";

dotenv.config({ path: "./.env" });

const TASKS = {
    similarity: computeVideoSimilarity,
    trending: computeTrendingScores,
    taste: rebuildAllTasteProfiles,
    stats: refreshVideoStats,
    all: runFullPipeline,
};

async function runOnce(name) {
    const task = TASKS[name];
    if (!task) {
        console.error(`Unknown job "${name}". Options: ${Object.keys(TASKS).join(", ")}`);
        process.exit(1);
    }

    console.log(`[jobs] running "${name}"...`);
    const started = Date.now();
    const result = await task();
    console.log(`[jobs] "${name}" done in ${Date.now() - started}ms`, result);
}

async function schedule() {
    // Trending moves fast — recompute every 30 minutes so the rail stays live.
    cron.schedule("*/30 * * * *", async () => {
        try {
            await refreshVideoStats();
            await computeTrendingScores();
        } catch (err) {
            console.error("[cron] trending failed:", err.message);
        }
    });

    // The similarity matrix is expensive and changes slowly. Nightly at 03:00,
    // when traffic is lowest.
    cron.schedule("0 3 * * *", async () => {
        try {
            await computeVideoSimilarity();
            await rebuildAllTasteProfiles();
        } catch (err) {
            console.error("[cron] nightly pipeline failed:", err.message);
        }
    });

    console.log("[jobs] scheduler running. Ctrl-C to stop.");
}

const mode = process.argv[2] || "all";

connectDB()
    .then(async () => {
        if (mode === "schedule") {
            await schedule();
        } else {
            await runOnce(mode);
            await mongoose.connection.close();
            process.exit(0);
        }
    })
    .catch((err) => {
        console.error("[jobs] startup failed:", err);
        process.exit(1);
    });
