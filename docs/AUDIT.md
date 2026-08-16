# Audit — state of the repo before this pass

Commit audited: `963bf55` · 45 files · Backend only.

## Summary

The backend is a scaffold from a tutorial template (`chai aur backend`). All
models, routes and middleware exist and are wired up correctly. **One of nine
controllers is implemented.** The Frontend directory contains a single empty
file. There is no streaming code and no recommendation code of any kind —
despite both being in the project title.

Implemented handlers: **11 of 40** (~28%).

---

## 1. Unimplemented controllers

Every function below existed as a named export with a `// TODO` body and an
empty return. Because they returned `undefined`, every one of these routes hung
until the client timed out rather than erroring.

| Controller | Handlers | Status |
|---|---|---|
| `video.controller.js` | 6 | all empty — including the core upload path |
| `comment.controller.js` | 4 | all empty |
| `like.controller.js` | 4 | all empty |
| `playlist.controller.js` | 7 | all empty |
| `subscription.controller.js` | 3 | all empty |
| `tweet.controller.js` | 4 | all empty |
| `dashboard.controller.js` | 2 | all empty |
| `user.controller.js` | 11 | implemented (see bugs below) |
| `healthcheck.controller.js` | 1 | implemented |

## 2. Missing entirely

| Missing | Impact |
|---|---|
| **Recommendation engine** | The project's headline feature. No model, service, job, or route. No interaction tracking to build one from. |
| **Streaming layer** | No HLS, no ABR ladder, no byte-range support, no signed URLs, no watch progress, no resume. `videoFile` was a bare Cloudinary URL. |
| **Watch/view tracking** | No `WatchEvent` collection. Without it, view counts, trending, analytics and recommendations are all impossible. |
| **Global error handler** | `asyncHandler` forwards errors to `next()`, but no error middleware was registered. Every `ApiError` fell through to Express's default handler → HTML stack trace, HTTP 500, leaked internals in production. **This silently broke every 400/403/404 in the codebase.** |
| **Frontend** | `Frontend/index.html` is 0 bytes. |
| **Rate limiting** | Login open to unlimited credential stuffing; upload open to disk exhaustion. |
| **Security headers** | No `helmet`, no compression. |
| **Seed data / tests / CI** | None. |
| **Asset deletion** | No `deleteFromCloudinary`. Deleted videos and replaced avatars stayed in the bucket permanently. |
| **Indexes** | Only the implicit `unique` ones. Every feed query was a collection scan. |

## 3. Bugs in the implemented code

| # | File | Bug | Consequence |
|---|---|---|---|
| 1 | `user.controller.js:216` | `const { accessToken, newRefreshToken } = ...` — the generator returns `refreshToken`, not `newRefreshToken` | `newRefreshToken` always `undefined`. Refresh set an empty cookie and logged the user out. |
| 2 | `user.controller.js:411` | `$in: [req.user?._id, "$subscribers.r"]` — field is `subscriber` | `isSubscribed` always `false` on every channel page. |
| 3 | `user.controller.js:54` | `req.files?.avatar[0]?.path` — chaining stops one level short | TypeError crash instead of a clean 400 when no avatar is sent. |
| 4 | `user.controller.js:66` | `uploadOnCloudinary(coverImageLocalPath)` called unconditionally with `undefined` | Wasted call on every registration without a cover image. |
| 5 | `utils/cloudinary.js` | `catch` block logs and returns `undefined` | Callers doing `avatar.url` crash with TypeError instead of getting an error. |
| 6 | `user.model.js:18` | `lowecase: true` — typo, not a Mongoose option | Emails never normalised; `Foo@x.com` and `foo@x.com` both register. |
| 7 | `multer.middleware.js` | `cb(null, file.originalname)` | Concurrent uploads of `video.mp4` overwrite each other. A crafted name like `../../app.js` escapes the temp directory. No type or size limit. |
| 8 | `subscription.routes.js` | `/c/:channelId` → `getSubscribedChannels`, `/u/:subscriberId` → `getUserChannelSubscribers` | Both handlers received the wrong kind of id. |
| 9 | `video.routes.js:13` | `router.use(verifyJWT)` on all routes | Logged-out visitors could not browse or watch anything. |
| 10 | `user.controller.js` | `secure: true` hardcoded on cookies | Browser silently drops the cookie over local http; every authed request 401s in dev. |
| 11 | `app.js` | `CORS_ORIGIN=*` with `credentials: true` | Browsers reject this combination outright. |
| 12 | `user.controller.js:487` | `user[0].watchHistory` with no guard | TypeError if the aggregate returns empty. |
| 13 | `video.model.js` | `duration` required but never computed anywhere | `publishAVideo` could not have satisfied the schema. |
| 14 | `package.json` | No `start` script (README documents one); `author` still the tutorial's | Production start fails. |
| 15 | `.env.sample` | Ships the tutorial author's Atlas URI and secrets as defaults | Weak secrets get copied into real deployments. |
| 16 | repo | `public/temp/life.jpg`, `programer.avif` committed | Upload scratch files in version control. |

## 4. Documentation accuracy

The existing `README.md` describes the project as "comprehensive" and "complete",
and documents endpoints that do not work:

- `GET /users/profile`, `PATCH /users/profile` — do not exist (actual paths are `/current-user`, `/update-account`)
- Every documented video, comment, like, subscription, playlist and dashboard endpoint routes to an empty function
- "Video Operations: Upload, stream, and manage videos" — none implemented
- Documented `npm run start` — script absent

Worth fixing before this goes in front of a recruiter or an examiner: a README
that overstates the code is a worse signal than a smaller, accurate one.
