import test from "node:test";
import assert from "node:assert/strict";

process.env.PLAYBACK_TOKEN_SECRET = "unit-test-secret";

const {
    parseRangeHeader,
    generateMasterManifest,
    issuePlaybackToken,
    verifyPlaybackToken,
    RENDITION_LADDER,
} = await import("../src/services/streaming/hls.service.js");

const { contentAffinity } = await import("../src/services/recommendation/tasteProfile.js");
const { decayFactor } = await import("../src/models/userTaste.model.js");
const { VIEW_THRESHOLD } = await import("../src/models/watchEvent.model.js");

// ---------------------------------------------------------------- range
test("parseRangeHeader: standard open-ended range", () => {
    const r = parseRangeHeader("bytes=0-", 1000);
    assert.equal(r.start, 0);
    assert.equal(r.end, 999);
    assert.equal(r.contentLength, 1000);
});

test("parseRangeHeader: explicit window", () => {
    const r = parseRangeHeader("bytes=200-499", 1000);
    assert.deepEqual([r.start, r.end, r.contentLength], [200, 499, 300]);
});

test("parseRangeHeader: suffix form returns the tail", () => {
    const r = parseRangeHeader("bytes=-500", 1000);
    assert.equal(r.start, 500);
    assert.equal(r.end, 999);
});

test("parseRangeHeader: caps huge ranges at 2MB to protect memory", () => {
    const r = parseRangeHeader("bytes=0-", 50 * 1024 * 1024);
    assert.equal(r.contentLength, 2 * 1024 * 1024);
});

test("parseRangeHeader: start beyond EOF is unsatisfiable (416)", () => {
    assert.equal(parseRangeHeader("bytes=5000-", 1000).unsatisfiable, true);
});

test("parseRangeHeader: inverted range is unsatisfiable", () => {
    assert.equal(parseRangeHeader("bytes=900-100", 1000).unsatisfiable, true);
});

test("parseRangeHeader: no header means no range", () => {
    assert.equal(parseRangeHeader(undefined, 1000), null);
});

// ------------------------------------------------------------- manifest
test("generateMasterManifest: valid HLS structure", () => {
    const m = generateMasterManifest([
        { label: "720p", height: 720, bitrate: 2800000, playlistUrl: "720.m3u8" },
        { label: "360p", height: 360, bitrate: 800000, playlistUrl: "360.m3u8" },
    ]);
    assert.ok(m.startsWith("#EXTM3U"), "must start with the HLS magic line");
    assert.match(m, /#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720/);
    assert.match(m, /#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360/);
    assert.ok(m.includes("720.m3u8") && m.includes("360.m3u8"));
});

test("rendition ladder: bitrates strictly descend (players need clear steps)", () => {
    for (let i = 1; i < RENDITION_LADDER.length; i++) {
        assert.ok(
            RENDITION_LADDER[i].bitrate < RENDITION_LADDER[i - 1].bitrate,
            `rung ${i} must be lower bitrate than ${i - 1}`
        );
    }
});

// ---------------------------------------------------------------- token
test("playback token: round-trips for the correct video", () => {
    const { token } = issuePlaybackToken("vid123", "user456", 3600);
    assert.equal(verifyPlaybackToken(token, "vid123"), true);
});

test("playback token: rejected for a different video (no token reuse)", () => {
    const { token } = issuePlaybackToken("vid123", "user456", 3600);
    assert.equal(verifyPlaybackToken(token, "vidOTHER"), false);
});

test("playback token: rejects a tampered signature", () => {
    const { token } = issuePlaybackToken("vid123", "user456", 3600);
    const [payload] = token.split(".");
    assert.equal(verifyPlaybackToken(`${payload}.${"0".repeat(64)}`, "vid123"), false);
});

test("playback token: rejects an expired token", () => {
    const { token } = issuePlaybackToken("vid123", "user456", -10);
    assert.equal(verifyPlaybackToken(token, "vid123"), false);
});

test("playback token: rejects garbage", () => {
    assert.equal(verifyPlaybackToken("not-a-token", "vid123"), false);
    assert.equal(verifyPlaybackToken("", "vid123"), false);
    assert.equal(verifyPlaybackToken(null, "vid123"), false);
});

// ------------------------------------------------------------ taste math
test("decayFactor: one half-life halves the weight", () => {
    assert.ok(Math.abs(decayFactor(30, 30) - 0.5) < 1e-9);
    assert.ok(Math.abs(decayFactor(60, 30) - 0.25) < 1e-9);
    assert.equal(decayFactor(0, 30), 1);
});

test("decayFactor: decays monotonically", () => {
    let prev = Infinity;
    for (let d = 0; d <= 120; d += 10) {
        const f = decayFactor(d);
        assert.ok(f < prev);
        prev = f;
    }
});

test("contentAffinity: strong match scores above a weak one", () => {
    const taste = { tagWeights: new Map([["react", 10], ["nodejs", 8], ["cooking", 0.2]]) };
    const strong = contentAffinity(taste, { tags: ["react", "nodejs"] });
    const weak = contentAffinity(taste, { tags: ["cooking"] });
    assert.ok(strong > weak, `expected ${strong} > ${weak}`);
});

test("contentAffinity: zero when nothing overlaps", () => {
    const taste = { tagWeights: new Map([["react", 10]]) };
    assert.equal(contentAffinity(taste, { tags: ["gardening", "fishing"] }), 0);
});

test("contentAffinity: bounded to [0,1]", () => {
    const taste = { tagWeights: new Map([["a", 100], ["b", 100]]) };
    const s = contentAffinity(taste, { tags: ["a", "b"] });
    assert.ok(s >= 0 && s <= 1, `got ${s}`);
});

test("contentAffinity: handles an empty or missing profile", () => {
    assert.equal(contentAffinity(null, { tags: ["a"] }), 0);
    assert.equal(contentAffinity({ tagWeights: new Map() }, { tags: ["a"] }), 0);
    assert.equal(contentAffinity({ tagWeights: new Map([["a", 1]]) }, { tags: [] }), 0);
});

test("contentAffinity: accepts a plain object profile (lean() results)", () => {
    const s = contentAffinity({ tagWeights: { react: 5, nodejs: 3 } }, { tags: ["react"] });
    assert.ok(s > 0, "must handle .lean() output where the Map became an object");
});

// -------------------------------------------------------- view threshold
test("VIEW_THRESHOLD sits in a sane range", () => {
    assert.ok(VIEW_THRESHOLD > 0 && VIEW_THRESHOLD < 1);
});

// ------------------------------------------- wilson bound (video model)
const { Video } = await import("../src/models/video.model.js");

test("likeConfidence: large sample outranks a tiny perfect one", () => {
    const tiny = new Video({ views: 3, likesCount: 3, title:"t", description:"d", videoFile:"v", thumbnail:"t", duration:1, owner: "507f1f77bcf86cd799439011" });
    const big = new Video({ views: 1000, likesCount: 900, title:"t", description:"d", videoFile:"v", thumbnail:"t", duration:1, owner: "507f1f77bcf86cd799439011" });
    assert.ok(big.likeConfidence() > tiny.likeConfidence(),
        `3/3 (${tiny.likeConfidence().toFixed(3)}) must not beat 900/1000 (${big.likeConfidence().toFixed(3)})`);
});

test("likeConfidence: zero views yields zero", () => {
    const v = new Video({ views: 0, likesCount: 0, title:"t", description:"d", videoFile:"v", thumbnail:"t", duration:1, owner: "507f1f77bcf86cd799439011" });
    assert.equal(v.likeConfidence(), 0);
});

test("video tags are normalised: lowercased, deduped, trimmed", () => {
    const v = new Video({ tags: ["  React ", "REACT", "nodejs", ""], title:"t", description:"d", videoFile:"v", thumbnail:"t", duration:1, owner: "507f1f77bcf86cd799439011" });
    assert.deepEqual(v.tags, ["react", "nodejs"]);
});
