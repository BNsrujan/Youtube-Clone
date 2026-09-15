/**
 * Media seed — populates the app with *real, playable* video.
 *
 * The original seed.js writes placeholder URLs (example.com/seed/N.mp4), which
 * is fine for exercising the recommender but leaves a site where nothing plays.
 * This script instead pulls openly-licensed video from Wikimedia Commons,
 * pushes it to Cloudinary, and stores genuine playback URLs.
 *
 * Cost control, because this is aimed at a metered/free Cloudinary plan:
 *   - No eager transcoding. Cloudinary builds the sp_hd ABR ladder on the fly
 *     on first request, so we pay only for what is actually watched.
 *   - Source files are size-capped well under the plan's per-file limit.
 *   - Uploaded assets are reused across several video documents, so the feed
 *     looks full without one upload per card.
 *
 * Run:  npm run seed:media -- --videos=60 --assets=24
 * Then: npm run jobs        (builds the similarity matrix + taste profiles)
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";

import connectDB from "../db/index.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { WatchEvent } from "../models/watchEvent.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import {
    RENDITION_LADDER,
    buildThumbnailUrl,
    buildPreviewSpriteUrl,
} from "../services/streaming/hls.service.js";

dotenv.config({ path: "./.env" });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---- tunables -----------------------------------------------------------

const args = Object.fromEntries(
    process.argv.slice(2)
        .filter((a) => a.startsWith("--"))
        .map((a) => {
            const [k, v] = a.replace(/^--/, "").split("=");
            return [k, v === undefined ? true : v];
        })
);

const NUM_VIDEOS = Number(args.videos ?? 60);   // Video documents to create
const NUM_ASSETS = Number(args.assets ?? 24);   // distinct Cloudinary uploads
const NUM_USERS = Number(args.users ?? 14);
const MAX_MB = Number(args.maxMb ?? 32);        // per-file download cap
const MAX_DURATION = Number(args.maxDuration ?? 900);
const CONCURRENCY = Number(args.concurrency ?? 2);
const DRY_RUN = Boolean(args["dry-run"]);
const FRESH = Boolean(args.fresh);
const DROP_PLACEHOLDERS = Boolean(args["drop-placeholders"]);
const SOURCE = String(args.source ?? "auto"); // pexels | archive | wikimedia | auto

const CLOUD_FOLDER = "videotube/seed";
const TEMP_DIR = "./public/temp";
const UA = "videotube-dev-seed/1.0 (local development seeding)";

// ---- helpers ------------------------------------------------------------

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const one = (arr) => arr[rand(0, arr.length - 1)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Commons metadata values are HTML fragments; flatten to readable text. */
const stripHtml = (html) =>
    String(html || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/**
 * Commons is full of journal supplementary material — "pone.0050901.s001",
 * "Movie1", accession numbers. Real titles matter here: the whole point of the
 * seed is a feed that looks like a video site, not a data repository.
 */
const JUNK_PATTERNS = [
    /\bpone\.\d/i, /\bpbio\.\d/i, /\bpgen\.\d/i, /journal\.p/i,
    /\bs\d{3}\b/i, /supplementary/i, /\bmovie\s?\d\b/i, /\bvideo\s?s\d\b/i,
    /\b\d{6,}\b/, /[a-z]\d{4,}[a-z]/i, /\bfig(ure)?\s?\d/i, /\badditional file/i,
    /\bsrep\d/i, /\bncomms\d/i, /\bmmc\d\b/i,
];

const looksLikeJunk = (title) =>
    !title || title.length < 6 || JUNK_PATTERNS.some((re) => re.test(title));

const titleFromFile = (fileTitle) => {
    let t = fileTitle
        .replace(/^File:/, "")
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Commons filenames routinely end in camera/date/accession noise —
    // "… NCSM Kolkata 2014 11 27 9842". Strip trailing number runs and the
    // 2-3 letter photographer sigils that follow them.
    t = t
        .replace(/\s+(?:\d{1,4}\s+){1,5}\d{1,5}\s*$/i, "")
        .replace(/\s+\d{3,}\s*$/i, "")
        .replace(/\s+\((?:oT|ies|ubt)\)\s*$/i, "")
        .replace(/\s+(?:ies|ubt|oT)\s*$/i, "")
        .replace(/\s*[–—-]\s*$/, "")
        .trim();

    return t.length > 96 ? `${t.slice(0, 93).trimEnd()}…` : t;
};

async function runPool(items, limit, worker) {
    const results = [];
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            try {
                results.push(await worker(items[index], index));
            } catch (err) {
                // Undici surfaces the real reason on `cause`; err.message is
                // often just "fetch failed" or undefined on its own.
                const reason =
                    err?.message ||
                    err?.cause?.message ||
                    err?.cause?.code ||
                    err?.code ||
                    String(err);
                const detail = err?.cause?.code && err.cause.code !== reason ? ` (${err.cause.code})` : "";
                console.warn(`   ! ${items[index]?.title?.slice(0, 48) ?? "item"}: ${reason}${detail}`);
            }
        }
    });
    await Promise.all(runners);
    return results.filter(Boolean);
}

// ---- source catalogue ---------------------------------------------------
/**
 * Search terms per app category, phrased as things a stock-video library
 * actually has footage of. Several per category, because any single term can
 * come back empty or rate-limited and a thin category shows up immediately as
 * a half-full row on the trending page.
 */
const CATEGORY_TERMS = {
    education: ["library books", "classroom", "science laboratory", "museum"],
    music: ["guitar playing", "piano", "dj mixing", "drums"],
    gaming: ["video game", "esports", "arcade", "keyboard gaming"],
    news: ["city crowd", "microphone speech", "newspaper", "traffic street"],
    sports: ["running track", "basketball", "swimming pool", "cycling"],
    tech: ["circuit board", "server room", "robot", "coding screen"],
    comedy: ["friends laughing", "party celebration", "dog funny", "balloons"],
    film: ["cinema", "camera filming", "studio lighting", "clapperboard"],
    howto: ["cooking", "woodworking", "painting art", "gardening"],
    travel: ["city night", "mountain landscape", "beach ocean", "train travel"],
    other: ["nature forest", "clouds timelapse", "waterfall", "coffee"],
};

const CATEGORY_TAGS = {
    education: ["tutorial", "explained", "science", "learning", "demo"],
    music: ["live", "performance", "acoustic", "concert", "instrumental"],
    gaming: ["gameplay", "strategy", "retro", "playthrough", "indie"],
    news: ["report", "current-affairs", "interview", "press"],
    sports: ["highlights", "athletics", "competition", "training"],
    tech: ["hardware", "robotics", "engineering", "gadgets", "build"],
    comedy: ["sketch", "standup", "improv", "funny"],
    film: ["shortfilm", "cinema", "animation", "story"],
    howto: ["diy", "guide", "repair", "tips", "handmade"],
    travel: ["timelapse", "cityscape", "journey", "aerial", "wanderlust"],
    other: ["nature", "ambient", "wildlife", "relaxing"],
};

// ---- 1. discover candidates --------------------------------------------
/**
 * Three providers, tried in order, because no single one is dependable here:
 *
 *   pexels    - best-looking footage, but the public endpoint only answers for
 *               queries that happen to be cached; the rest return 401.
 *   archive   - Prelinger Archives. Public domain, always up, older material.
 *   wikimedia - good metadata and licensing, but upload.wikimedia.org
 *               rate-limits whole IP ranges at the edge with no retry-after.
 *
 * Each returns the same candidate shape so the upload path never learns which
 * one produced a given file.
 */

/**
 * fetch with a hard deadline. Node's fetch has no default timeout, so a CDN
 * that accepts the connection and then stops sending bytes stalls a pool
 * worker indefinitely — which is exactly what happened mid-run.
 */
async function fetchWithTimeout(url, { timeoutMs = 60_000, ...init } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...init,
            headers: { "User-Agent": UA, ...(init.headers ?? {}) },
            signal: controller.signal,
        });
    } catch (err) {
        if (err.name === "AbortError") throw new Error(`timed out after ${timeoutMs}ms`);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

async function getJson(url, headers = {}) {
    const res = await fetchWithTimeout(url, { headers, timeoutMs: 25_000 });
    if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
    return res.json();
}

const providers = {
    async pexels(term) {
        const key = process.env.PEXELS_API_KEY;
        const json = await getJson(
            `https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&per_page=12`,
            key ? { Authorization: key } : {}
        );
        if (!json.videos) throw new Error("no videos in response");

        return json.videos
            .map((v) => {
                // Prefer the largest file still at or under 720p: big enough to
                // look right in the player, small enough to stay cheap.
                const file = v.video_files
                    .filter((f) => (f.height || 0) >= 240 && (f.height || 0) <= 720)
                    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
                if (!file) return null;

                return {
                    id: `pexels-${v.id}`,
                    title: titleFromPexels(v),
                    url: file.link,
                    sizeMb: 0, // not advertised; enforced from content-length at download
                    duration: Math.round(v.duration || 0),
                    mime: file.file_type || "video/mp4",
                    width: file.width,
                    height: file.height,
                    license: "Pexels License",
                    author: v.user?.name || "Pexels contributor",
                    sourcePage: v.url,
                    blurb: "",
                };
            })
            .filter(Boolean)
            .filter((c) => c.duration >= 4 && c.duration <= MAX_DURATION);
    },

    async archive(term) {
        const search = await getJson(
            "https://archive.org/advancedsearch.php?q=" +
                encodeURIComponent(`collection:(prelinger) AND mediatype:(movies) AND ${term}`) +
                "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=description&rows=8&output=json"
        );
        const docs = search.response?.docs ?? [];
        const out = [];

        for (const doc of docs.slice(0, 5)) {
            let meta;
            try {
                meta = await getJson(`https://archive.org/metadata/${doc.identifier}`);
            } catch {
                continue;
            }
            // Prefer the 512kb derivative — the "edit"/original cuts run to
            // hundreds of MB for the same content.
            const file = (meta.files ?? [])
                .filter((f) => f.name?.toLowerCase().endsWith(".mp4") && Number(f.size) > 0)
                .sort((a, b) => Number(a.size) - Number(b.size))[0];
            if (!file) continue;

            const sizeMb = Number(file.size) / 1048576;
            if (sizeMb > MAX_MB) continue;

            out.push({
                id: `archive-${doc.identifier}`,
                title: String(doc.title || doc.identifier).slice(0, 96),
                url: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(file.name)}`,
                sizeMb,
                duration: Math.round(Number(file.length) || 0) || 120,
                mime: "video/mp4",
                width: Number(file.width) || 640,
                height: Number(file.height) || 360,
                license: "Public domain (Prelinger Archives)",
                author: "Prelinger Archives",
                sourcePage: `https://archive.org/details/${doc.identifier}`,
                blurb: String(doc.description || "").replace(/<[^>]*>/g, " ").slice(0, 300),
            });
            await sleep(200);
        }
        return out;
    },

    async wikimedia(term) {
        const json = await getJson(
            "https://commons.wikimedia.org/w/api.php?action=query&format=json&maxlag=5" +
                `&generator=search&gsrsearch=${encodeURIComponent(`filetype:video ${term}`)}` +
                `&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime|extmetadata`
        );
        return Object.values(json.query?.pages ?? [])
            .map((page) => {
                const info = page.imageinfo?.[0];
                if (!info) return null;
                const meta = info.extmetadata ?? {};
                return {
                    id: `commons-${page.pageid}`,
                    title: titleFromFile(page.title),
                    url: info.url,
                    sizeMb: info.size / 1048576,
                    duration: Math.round(info.duration || 0),
                    mime: info.mime,
                    width: info.width,
                    height: info.height,
                    license: stripHtml(meta.LicenseShortName?.value) || "see source",
                    author: stripHtml(meta.Artist?.value).slice(0, 80) || "Wikimedia contributor",
                    sourcePage: info.descriptionurl,
                    blurb: stripHtml(meta.ImageDescription?.value).slice(0, 320),
                };
            })
            .filter(Boolean)
            .filter(
                (c) =>
                    c.sizeMb <= MAX_MB &&
                    c.duration >= 4 &&
                    c.duration <= MAX_DURATION &&
                    (c.mime.startsWith("video/") || c.mime === "application/ogg") &&
                    !looksLikeJunk(c.title)
            );
    },
};

/** Pexels has no title field — derive one from the page slug. */
function titleFromPexels(video) {
    const slug = String(video.url || "").split("/").filter(Boolean).pop() || "";
    const words = slug.replace(/-\d+$/, "").replace(/-/g, " ").trim();
    const title = words.charAt(0).toUpperCase() + words.slice(1);
    return title.length >= 4 ? title.slice(0, 96) : `Untitled clip ${video.id}`;
}

async function discoverAssets(target) {
    const order = SOURCE === "auto" ? ["pexels", "archive", "wikimedia"] : [SOURCE];
    console.log(`[seed] discovering ~${target} source videos (providers: ${order.join(" → ")})...`);

    const perCategory = Math.ceil(target / Object.keys(CATEGORY_TERMS).length);
    const chosen = [];
    const seen = new Set();

    for (const [category, terms] of Object.entries(CATEGORY_TERMS)) {
        let taken = 0;
        const notes = [];

        for (const provider of order) {
            if (taken >= perCategory) break;

            for (const term of terms) {
                if (taken >= perCategory || chosen.length >= target) break;

                let candidates = [];
                try {
                    candidates = await providers[provider](term);
                } catch (err) {
                    notes.push(`${provider}:${term} ${err.message}`);
                    continue;
                }

                for (const candidate of candidates) {
                    if (taken >= perCategory || chosen.length >= target) break;
                    if (seen.has(candidate.id)) continue;
                    seen.add(candidate.id);
                    chosen.push({ ...candidate, category, provider });
                    taken++;
                }
                await sleep(250);
            }
        }

        console.log(
            `   ${category.padEnd(10)} ${String(taken).padStart(2)} candidates` +
                (taken < perCategory && notes.length ? `   (${notes[0]})` : "")
        );
    }

    return chosen;
}

// ---- 2. download + upload ----------------------------------------------

async function downloadToTemp(candidate) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const ext = path.extname(new URL(candidate.url).pathname) || ".webm";
    const dest = path.join(TEMP_DIR, `seed-${crypto.randomBytes(8).toString("hex")}${ext}`);

    // upload.wikimedia.org rate-limits as aggressively as the API does, and a
    // 429 here is transient — retrying costs one wait, giving up costs an asset.
    let res;
    let lastError;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            res = await fetchWithTimeout(candidate.url, { timeoutMs: 90_000 });
        } catch (err) {
            // A thrown fetch (ECONNRESET, ENOTFOUND, socket hang-up) is just
            // as transient as a 429 and was previously fatal for the item.
            lastError = err;
            res = null;
            await sleep(2000 * 2 ** attempt + Math.random() * 500);
            continue;
        }
        if (res.ok) break;
        if (res.status !== 429 && res.status !== 503) break;
        const wait = Number(res.headers.get("retry-after") || 0) * 1000 || 2000 * 2 ** attempt;
        await sleep(wait + Math.random() * 500);
    }

    if (!res) {
        const cause = lastError?.cause?.code || lastError?.message || "network error";
        throw new Error(`download failed (${cause})`);
    }
    if (!res.ok) throw new Error(`download ${res.status}`);

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared && declared / 1048576 > MAX_MB) {
        throw new Error(`${candidate.title} is ${(declared / 1048576).toFixed(1)}MB, over the ${MAX_MB}MB cap`);
    }

    // The response headers arriving does not mean the body will. Cap the read
    // separately, or a trickling connection stalls the worker just as badly.
    const stall = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`body stalled for ${candidate.title}`)), 120_000)
    );
    try {
        await Promise.race([
            pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest)),
            stall,
        ]);
    } catch (err) {
        if (fs.existsSync(dest)) {
            try { fs.unlinkSync(dest); } catch { /* best effort */ }
        }
        throw err;
    }
    return dest;
}

async function uploadAsset(candidate) {
    const localPath = await downloadToTemp(candidate);
    try {
        const result = await cloudinary.uploader.upload(localPath, {
            resource_type: "video",
            folder: CLOUD_FOLDER,
            // Deliberately no `eager`: the sp_hd ladder is generated on demand,
            // so seeding costs storage only, not one transcode per rendition.
            //
            // Cloudinary assigns a random public_id, so the provenance has to
            // travel with the asset — otherwise a re-run that reuses what is
            // already uploaded has nothing to build a title from and the feed
            // fills up with cards called "Luyk3wwne49zuhhkfxlc".
            context: {
                title: candidate.title,
                author: candidate.author,
                license: candidate.license,
                source: candidate.sourcePage ?? "",
                category: candidate.category,
            },
        });

        const height = result.height || 720;
        return {
            ...candidate,
            publicId: result.public_id,
            sourceUrl: result.secure_url,
            duration: Math.round(result.duration || candidate.duration || 0),
            height,
            width: result.width,
            bytes: result.bytes,
            hlsMasterUrl: cloudinary.url(result.public_id, {
                resource_type: "video",
                streaming_profile: "hd",
                format: "m3u8",
                secure: true,
            }),
            renditions: RENDITION_LADDER.filter((r) => r.height <= height).map((r) => ({
                label: r.label,
                height: r.height,
                bitrate: r.bitrate,
                codec: "h264",
                playlistUrl: cloudinary.url(result.public_id, {
                    resource_type: "video",
                    format: "m3u8",
                    height: r.height,
                    bit_rate: r.bitrate,
                    crop: "limit",
                    secure: true,
                }),
            })),
            thumbnail: buildThumbnailUrl(result.public_id, result.duration || 0),
            previewSpriteUrl: buildPreviewSpriteUrl(result.public_id),
        };
    } finally {
        if (fs.existsSync(localPath)) {
            try { fs.unlinkSync(localPath); } catch { /* best effort */ }
        }
    }
}

/** Reuse assets already sitting in the Cloudinary folder from a previous run. */
async function existingAssets() {
    // Retry rather than fall through to []: an empty list here means the run
    // re-uploads everything it already has, quietly doubling storage spend.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await cloudinary.api.resources({
                resource_type: "video",
                type: "upload",
                prefix: CLOUD_FOLDER,
                max_results: 200,
                context: true,
            });
            return res.resources ?? [];
        } catch (err) {
            if (attempt === 2) {
                throw new Error(
                    `could not list existing assets (${err.message}); ` +
                    `refusing to upload duplicates`
                );
            }
            await sleep(1500 * (attempt + 1));
        }
    }
    return [];
}

// ---- 3. build the database ---------------------------------------------

const CHANNEL_NAMES = [
    ["orbitlab", "Orbit Lab"], ["quietmachines", "Quiet Machines"], ["thefieldnotes", "Field Notes"],
    ["northbound", "Northbound"], ["copperwire", "Copper Wire"], ["slowmotionclub", "Slow Motion Club"],
    ["atlasandco", "Atlas & Co"], ["thirdshelf", "Third Shelf"], ["paperlanterns", "Paper Lanterns"],
    ["midnightdiner", "Midnight Diner"], ["glasshouse", "Glasshouse"], ["riverstone", "Riverstone"],
    ["tinyworkshop", "Tiny Workshop"], ["lumenandsalt", "Lumen & Salt"], ["backroads", "Backroads"],
    ["signalhill", "Signal Hill"], ["driftwoodfm", "Driftwood FM"], ["openkitchen", "Open Kitchen"],
];

async function ensureUsers(count) {
    const users = [];
    for (const [username, fullName] of CHANNEL_NAMES.slice(0, count)) {
        let user = await User.findOne({ username });

        if (!user) {
            try {
                user = await User.create({
                    username,
                    email: `${username}@seed.local`,
                    fullName,
                    avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${username}`,
                    coverImage: `https://picsum.photos/seed/${username}-cover/1600/400`,
                    password: "Password123!",
                });
            } catch (err) {
                // findOne-then-create is not atomic. Two seeders running at
                // once (or a re-run racing a previous one) both see "absent"
                // and both insert; the loser gets E11000. The row it wanted
                // now exists, which is all this function actually needs.
                if (err?.code !== 11000) throw err;
                user = await User.findOne({ username });
                if (!user) throw err;
            }
        }

        user._preferredCategories = pick(Object.keys(CATEGORY_TERMS), rand(1, 2));
        users.push(user);
    }
    return users;
}

function buildDescription(asset) {
    const lines = [];
    if (asset.blurb) lines.push(asset.blurb);
    const credit = [asset.author, asset.license].filter(Boolean).join(" · ");
    lines.push(`\n— ${credit}${asset.sourcePage ? `\n${asset.sourcePage}` : ""}`);
    return lines.join("\n");
}

/**
 * Variant titles so reused assets do not read as obvious duplicates. The card
 * grid is the thing being made to look populated, and identical titles are the
 * first tell.
 */
const TITLE_SHAPES = [
    (t) => t,
    (t) => `${t} — full clip`,
    (t) => `${t} (behind the scenes)`,
    (t) => `Revisiting: ${t}`,
    (t) => `${t} · extended cut`,
    (t) => `A closer look at ${t.toLowerCase()}`,
];

async function createVideos(assets, users, target) {
    const videos = [];
    for (let i = 0; i < target; i++) {
        const asset = assets[i % assets.length];
        const owner = one(users);
        const shape = TITLE_SHAPES[Math.floor(i / assets.length) % TITLE_SHAPES.length];
        const title = shape(asset.title).slice(0, 110);

        const existing = await Video.findOne({ title, owner: owner._id });
        if (existing) { videos.push(existing); continue; }

        const video = await Video.create({
            videoFile: asset.sourceUrl,
            publicId: asset.publicId,
            hlsMasterUrl: asset.hlsMasterUrl,
            renditions: asset.renditions,
            thumbnail: asset.thumbnail,
            previewSpriteUrl: asset.previewSpriteUrl,
            duration: asset.duration,
            transcodeStatus: "ready",
            title,
            description: buildDescription(asset),
            tags: pick(CATEGORY_TAGS[asset.category] ?? ["video"], rand(2, 4)),
            category: asset.category,
            isPublished: true,
            visibility: "public",
            owner: owner._id,
            views: rand(120, 48_000),
            createdAt: new Date(Date.now() - rand(0, 75) * 86_400_000),
        });
        videos.push(video);
    }
    return videos;
}

async function createEngagement(users, videos) {
    let watchCount = 0;
    let likeCount = 0;

    for (const user of users) {
        const preferred = videos.filter((v) => user._preferredCategories.includes(v.category));
        const other = videos.filter((v) => !user._preferredCategories.includes(v.category));
        const toWatch = [...pick(preferred, rand(10, 20)), ...pick(other, rand(3, 7))];

        for (const video of toWatch) {
            const isPreferred = user._preferredCategories.includes(video.category);
            const ratio = isPreferred
                ? Math.min(0.5 + Math.random() * 0.5, 1)
                : Math.random() * 0.5;

            // Recent enough to land inside the trending job's 72h window for
            // a slice of the history, older for the rest.
            const ageDays = Math.random() < 0.35 ? Math.random() * 2.5 : rand(3, 40);

            await WatchEvent.updateOne(
                { user: user._id, video: video._id },
                {
                    $set: {
                        watchSeconds: Math.round(video.duration * ratio),
                        lastPositionSeconds: Math.round(video.duration * ratio),
                        watchRatio: ratio,
                        completed: ratio >= 0.9,
                        countedAsView: ratio >= 0.3,
                        source: one(["home", "search", "related", "trending", "direct"]),
                        device: one(["web", "web", "mobile"]),
                        createdAt: new Date(Date.now() - ageDays * 86_400_000),
                    },
                },
                { upsert: true }
            );
            watchCount++;

            if (ratio > 0.65 && Math.random() > 0.45) {
                const res = await Like.updateOne(
                    { video: video._id, likedBy: user._id },
                    { $setOnInsert: { video: video._id, likedBy: user._id } },
                    { upsert: true }
                );
                if (res.upsertedCount) {
                    await Video.findByIdAndUpdate(video._id, { $inc: { likesCount: 1 } });
                    likeCount++;
                }
            }
        }
    }

    let subCount = 0;
    for (const user of users) {
        const channels = pick(users.filter((u) => String(u._id) !== String(user._id)), rand(3, 8));
        for (const channel of channels) {
            const res = await Subscription.updateOne(
                { subscriber: user._id, channel: channel._id },
                { $setOnInsert: { subscriber: user._id, channel: channel._id } },
                { upsert: true }
            );
            if (res.upsertedCount) subCount++;
        }
    }

    return { watchCount, likeCount, subCount };
}

// ---- main ---------------------------------------------------------------

/** Admin-API usage with retries; never fatal. */
async function safeUsage() {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await cloudinary.api.usage();
        } catch {
            await sleep(1500 * (attempt + 1));
        }
    }
    return null;
}

const LOCK_FILE = "./public/temp/.seedMedia.lock";

/**
 * Two seeders at once is not a theoretical problem: they race on user inserts
 * (E11000) and between them saturate the source CDN badly enough that most
 * downloads fail. One at a time.
 */
function acquireLock() {
    try {
        fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
        const fd = fs.openSync(LOCK_FILE, "wx");
        fs.writeSync(fd, String(process.pid));
        fs.closeSync(fd);
    } catch (err) {
        if (err.code !== "EEXIST") throw err;

        const owner = Number(fs.readFileSync(LOCK_FILE, "utf8").trim());
        let alive = false;
        try { process.kill(owner, 0); alive = true; } catch { alive = false; }

        if (alive) {
            throw new Error(
                `another seed is already running (pid ${owner}). ` +
                `Wait for it, or kill it and delete ${LOCK_FILE}`
            );
        }
        // Previous run died without cleaning up; take it over.
        fs.writeFileSync(LOCK_FILE, String(process.pid));
    }

    const release = () => {
        try {
            if (fs.existsSync(LOCK_FILE) &&
                fs.readFileSync(LOCK_FILE, "utf8").trim() === String(process.pid)) {
                fs.unlinkSync(LOCK_FILE);
            }
        } catch { /* best effort */ }
    };
    process.on("exit", release);
    process.on("SIGINT", () => { release(); process.exit(130); });
    process.on("SIGTERM", () => { release(); process.exit(143); });
}

async function main() {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
        throw new Error("Cloudinary credentials missing from .env");
    }
    acquireLock();

    // Quota reporting is a nicety. It sits on the Admin API, which resets
    // connections often enough that letting it abort the run means losing a
    // whole seed to a blip before a single byte was uploaded.
    const before = await safeUsage();
    if (before) {
        console.log(
            `[seed] Cloudinary plan "${before.plan}" — ${before.credits.usage}/${before.credits.limit} credits used\n`
        );
    } else {
        console.log("[seed] Cloudinary usage unavailable (continuing)\n");
    }

    // The original seed.js writes videoFile: "https://example.com/seed/N.mp4".
    // Those rows render a card and then fail to play, which is worse than not
    // being there — the feed looks populated and the product looks broken.
    if (DROP_PLACEHOLDERS) {
        const { deletedCount } = await Video.deleteMany({
            $or: [
                { title: /^\[seed\]/ },
                { videoFile: /^https:\/\/example\.com\// },
            ],
        });
        console.log(`[seed] removed ${deletedCount} placeholder video(s) that cannot play`);
    }

    if (FRESH) {
        console.log("[seed] --fresh: clearing seeded content and all engagement...");
        await Promise.all([
            Video.deleteMany({ publicId: new RegExp(`^${CLOUD_FOLDER}/`) }),
            WatchEvent.deleteMany({}),
            Subscription.deleteMany({}),
            Like.deleteMany({}),
        ]);
    }

    // Reuse anything already uploaded so re-runs are cheap.
    const already = await existingAssets();
    console.log(`[seed] ${already.length} asset(s) already in ${CLOUD_FOLDER}`);

    const needed = Math.max(0, NUM_ASSETS - already.length);
    let uploaded = [];

    if (needed > 0) {
        const candidates = await discoverAssets(Math.ceil(needed * 1.6));
        console.log(`\n[seed] ${candidates.length} candidates passed filters; uploading ${needed}...`);

        if (DRY_RUN) {
            candidates.slice(0, needed).forEach((c) =>
                console.log(`   would upload: ${c.title} (${c.sizeMb.toFixed(1)}MB, ${c.duration}s, ${c.category})`)
            );
            return;
        }

        // Over-fetch slightly: some downloads 404 or blow the size cap, and a
        // counter (not `uploaded`, which is only assigned once runPool
        // resolves) is what stops the pool once the target is met.
        let done = 0;
        uploaded = await runPool(candidates.slice(0, Math.ceil(needed * 1.6)), CONCURRENCY, async (candidate) => {
            if (done >= needed) return null;
            const asset = await uploadAsset(candidate);
            done++;
            await sleep(600); // keep the aggregate download rate civil
            console.log(`   ✓ ${asset.title.slice(0, 52).padEnd(52)} ${(asset.bytes / 1048576).toFixed(1)}MB ${asset.duration}s`);
            return asset;
        });
    }

    // Rehydrate previously-uploaded assets into the same shape.
    const reused = already.map((r) => {
        const height = r.height || 720;
        const ctx = r.context?.custom ?? {};
        return {
            title: ctx.title || `Untitled clip ${r.public_id.slice(-4)}`,
            category: CATEGORY_TAGS[ctx.category] ? ctx.category : one(Object.keys(CATEGORY_TERMS)),
            publicId: r.public_id,
            sourceUrl: r.secure_url,
            duration: Math.round(r.duration || 60),
            height,
            bytes: r.bytes,
            license: ctx.license || "see source",
            author: ctx.author || "Unknown",
            sourcePage: ctx.source || "",
            blurb: "",
            hlsMasterUrl: cloudinary.url(r.public_id, { resource_type: "video", streaming_profile: "hd", format: "m3u8", secure: true }),
            renditions: RENDITION_LADDER.filter((x) => x.height <= height).map((x) => ({
                label: x.label, height: x.height, bitrate: x.bitrate, codec: "h264",
                playlistUrl: cloudinary.url(r.public_id, { resource_type: "video", format: "m3u8", height: x.height, bit_rate: x.bitrate, crop: "limit", secure: true }),
            })),
            thumbnail: buildThumbnailUrl(r.public_id, r.duration || 0),
            previewSpriteUrl: buildPreviewSpriteUrl(r.public_id),
        };
    });

    const assets = [...reused, ...uploaded];
    if (!assets.length) throw new Error("No usable assets — nothing uploaded or found");

    console.log(`\n[seed] ${assets.length} playable asset(s) available`);
    console.log(`[seed] creating ${NUM_USERS} channels...`);
    const users = await ensureUsers(NUM_USERS);

    console.log(`[seed] creating ${NUM_VIDEOS} video documents...`);
    const videos = await createVideos(assets, users, NUM_VIDEOS);

    console.log("[seed] generating watch history, likes and subscriptions...");
    const { watchCount, likeCount, subCount } = await createEngagement(users, videos);

    const after = await safeUsage();
    const spent =
        after && before ? (after.credits.usage - before.credits.usage).toFixed(3) : "?";

    console.log(`
[seed] done.
  channels:       ${users.length}
  videos:         ${videos.length}   (from ${assets.length} distinct uploads)
  watch events:   ${watchCount}
  likes:          ${likeCount}
  subscriptions:  ${subCount}

  Cloudinary:     ${after ? `${after.credits.usage}/${after.credits.limit} credits (this run: +${spent})` : "usage unavailable"}

Next: npm run jobs      # similarity matrix, taste profiles, trending scores
Sign in as any of: ${CHANNEL_NAMES.slice(0, Math.min(3, NUM_USERS)).map((c) => c[0]).join(", ")} … / Password123!
`);
}

connectDB()
    .then(main)
    .then(async () => {
        await mongoose.connection.close();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error("[seed] failed:", err);
        await mongoose.connection.close().catch(() => {});
        process.exit(1);
    });
