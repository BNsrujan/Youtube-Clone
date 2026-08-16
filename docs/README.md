# Video Streaming Platform with Recommendation Engine

A YouTube-style backend: HLS adaptive-bitrate video delivery and a hybrid
recommendation engine combining collaborative filtering, content-based
filtering, and popularity signals.

**Stack** — Node.js · Express · MongoDB (Mongoose) · JWT · Cloudinary · HLS

---

## What it does

- **Adaptive streaming** — five-rung rendition ladder, 6-second HLS segments,
  client-side bitrate switching, signed short-lived playback tokens, byte-range
  fallback for non-HLS clients
- **Hybrid recommendations** — two-stage pipeline (candidate generation →
  ranking) drawing on five retrieval sources, with diversity re-ranking and an
  explainability endpoint
- **Watch tracking** — progress heartbeats, resume-where-you-left-off,
  threshold-based view counting that resists refresh-loop inflation
- **Social layer** — subscriptions, likes, comments, playlists, short posts
- **Creator analytics** — views, watch hours, retention, 30-day trend

---

## Setup

```bash
cd Backend
npm install
cp .env.sample .env      # then fill in the values
npm run dev
```

Generate the token secrets rather than inventing them:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Seeding

The recommender needs interaction data to do anything. With an empty database
every request falls back to cold start.

```bash
npm run seed     # 20 users, 80 videos, realistic watch patterns
npm run jobs     # build similarity matrix + taste profiles
```

Seeded accounts: `seeduser1` … `seeduser20`, password `Password123!`

### Offline jobs

```bash
npm run jobs                  # full pipeline once
npm run jobs:schedule         # stay resident, run on cron
node src/jobs/runJobs.js similarity   # individual job
```

In production run `jobs:schedule` as a separate process — trending refreshes
every 30 minutes, the similarity matrix nightly at 03:00.

### Tests

```bash
node --test tests/unit.test.mjs
```

---

## API

Base URL `/api/v1`. Auth via `Authorization: Bearer <token>` or the
`accessToken` cookie.

### Users
| Method | Path | Auth |
|---|---|---|
| POST | `/users/register` | — |
| POST | `/users/login` | — |
| POST | `/users/logout` | ✓ |
| POST | `/users/refresh-token` | — |
| POST | `/users/change-password` | ✓ |
| GET | `/users/current-user` | ✓ |
| PATCH | `/users/update-account` | ✓ |
| PATCH | `/users/avatar` · `/users/cover-image` | ✓ |
| GET | `/users/c/:username` | ✓ |
| GET | `/users/history` | ✓ |

### Videos
| Method | Path | Auth |
|---|---|---|
| GET | `/videos` | optional |
| POST | `/videos` | ✓ |
| GET | `/videos/:videoId` | optional |
| PATCH · DELETE | `/videos/:videoId` | ✓ owner |
| PATCH | `/videos/toggle/publish/:videoId` | ✓ owner |

`GET /videos` accepts `page`, `limit`, `query`, `sortBy`, `sortType`, `userId`.

### Streaming
| Method | Path | Auth |
|---|---|---|
| GET | `/stream/:videoId/manifest` | optional |
| GET | `/stream/:videoId/master.m3u8` | optional + token |
| GET | `/stream/:videoId/download` | optional + token |
| POST | `/stream/:videoId/progress` | optional |
| GET | `/stream/continue-watching` | ✓ |
| POST | `/stream/webhook/transcode` | provider |

### Recommendations
| Method | Path | Auth |
|---|---|---|
| GET | `/recommendations/feed` | optional |
| GET | `/recommendations/related/:videoId` | optional |
| GET | `/recommendations/trending` | optional |
| GET | `/recommendations/why/:videoId` | ✓ |
| GET · DELETE | `/recommendations/profile` | ✓ |
| POST | `/recommendations/rebuild` | ✓ |

`?explain=true` on `/feed` returns per-signal score breakdowns.

### Social
| Method | Path | Auth |
|---|---|---|
| GET · POST | `/comments/:videoId` | optional · ✓ |
| PATCH · DELETE | `/comments/c/:commentId` | ✓ |
| POST | `/likes/toggle/v/:videoId` · `/c/:commentId` · `/t/:tweetId` | ✓ |
| GET | `/likes/videos` | ✓ |
| POST | `/subscriptions/toggle/:channelId` | ✓ |
| GET | `/subscriptions/c/:subscriberId` | optional |
| GET | `/subscriptions/u/:channelId` | optional |
| POST · GET · PATCH · DELETE | `/playlist/...` | ✓ |
| GET | `/dashboard/stats` · `/dashboard/videos` | ✓ |

---

## Player integration

```js
import Hls from "hls.js";

const { data } = await fetch(`/api/v1/stream/${videoId}/manifest`, {
  credentials: "include",
}).then(r => r.json());

const hls = new Hls();
hls.loadSource(data.masterPlaylistUrl);
hls.attachMedia(videoEl);

videoEl.currentTime = data.resumeAt;   // resume where they left off

// Heartbeat — drives views, resume points, and the recommender.
let watched = 0, last = 0;
videoEl.addEventListener("timeupdate", () => {
  if (videoEl.currentTime > last) watched += videoEl.currentTime - last;
  last = videoEl.currentTime;
});

setInterval(() => {
  navigator.sendBeacon(`/api/v1/stream/${videoId}/progress`,
    new Blob([JSON.stringify({
      positionSeconds: videoEl.currentTime,
      watchedSeconds: watched,
      source: "home",
    })], { type: "application/json" }));
}, 10000);
```

---

## Frontend

```bash
cd Frontend
npm install
npm run dev      # http://localhost:3000
```

Next.js 15 (App Router) + TypeScript. Rewrites `/api` to port 8000, so the
session cookie stays same-origin. The feed, watch page and Studio are Server
Components that fetch with the forwarded cookie, so personalised data lands in
the first paint. See [`../Frontend/README.md`](../Frontend/README.md).

---

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the streaming and recommendation
designs in detail, and [`AUDIT.md`](./AUDIT.md) for what was fixed and why.
