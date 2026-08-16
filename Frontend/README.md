# videotube — frontend

Next.js 15 (App Router) + TypeScript client for the video platform. Deliberately
**not** a YouTube visual clone: the interface is built to make the streaming and
recommendation machinery visible, because that machinery is the point of the
project.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

`next.config.mjs` rewrites `/api/*` to `http://localhost:8000`, so the browser
only ever sees one origin — no CORS preflight, no `SameSite=None`, and no
third-party-cookie blocking on the httpOnly session cookie. Start the backend
first.

Seeded logins: `seeduser1` … `seeduser20` / `Password123!`

```bash
npm run build        # production build
npm run typecheck    # tsc --noEmit
```

## Why Next.js here, specifically

The feed is the slowest call in the app — five retrieval sources plus a ranking
pass. In a client-rendered SPA that cost sits on the critical path: HTML, then
JS, then the fetch, then finally videos.

Here it's a Server Component. `lib/api-server.ts` reads the session cookie with
`cookies()` and calls the Express API before the response is sent, so the
personalised slate arrives in the first paint. Same for the watch page, the
channel page and Studio.

The split that follows from that:

| Server (no client JS) | Client (`"use client"`) |
|---|---|
| Feed, watch page, trending, search, channel, Studio | `VideoPlayer` — owns a media element |
| `VideoCard`, `VideoGrid`, `SignalBars` | `WatchActions` — optimistic like/subscribe |
| Comment list, score breakdowns | `WhyPanel`, `Comments`, `TasteProfilePanel` |
| Auth redirects for `/upload`, `/studio` | `ScoringToggle`, `CategoryFilter` |

Cards are the bulk of every page and none of them need JS, so a 24-video feed
hydrates no more than an empty one. First Load JS is 107 kB on the home route.

Other things the framework is actually being used for, not just tolerated:

- **Streaming Suspense** — the related rail, comments and continue-watching each
  arrive independently, so a slow similarity lookup never delays the player.
- **URL as state** — "Show scoring" and the trending category filter write to
  the query string, so the server re-renders with the new data and the setting
  survives a reload or a shared link. `useTransition` keeps the old content on
  screen while the new one streams.
- **Server-side auth guards** — an unauthenticated visitor to `/upload` never
  receives the form markup, rather than being bounced after hydration.
- **`generateMetadata`** — a shared watch link gets a real title and OG card.

## The two things worth looking at

**The telemetry strip** (under the player, `components/VideoPlayer.tsx`)
Live readout of the active rendition, ladder position, measured throughput,
buffer depth and watch ratio — with an explicit "view counted / below 30%"
state. Throttle your network in devtools and watch the rung step down and
recover. That's the adaptive bitrate algorithm working, normally invisible.

**The scoring panel** (*Why you're seeing this*, on any watch page)
The per-signal breakdown for that video against your profile, plus which of your
learned tags matched. Coloured pips under every card use the same palette to
show which retrieval source surfaced it. Toggle **Show scoring** on the home
feed to annotate the whole slate.

## Structure

```
src/
├── app/
│   ├── layout.tsx              root layout, next/font, server-resolved session
│   ├── page.tsx                home feed (server)
│   ├── loading.tsx / error.tsx / not-found.tsx
│   ├── watch/[videoId]/        player + streamed rail, comments, why-panel
│   ├── trending/ search/ channel/[username]/
│   └── login/ register/ upload/ studio/
├── components/                 server components unless marked "use client"
├── context/AuthContext.tsx     seeded from the server, no auth flash
├── lib/
│   ├── api-server.ts           cookie-forwarding fetch for Server Components
│   ├── api-client.ts           mutations + heartbeats, with token refresh
│   └── format.ts               shared by both
└── types/index.ts              response shapes from the Express API
```

## Notes and gotchas

- **`next/font` fetches from Google at build time.** If you build in a
  network-isolated CI or Docker stage, `npm run build` fails. Either allow
  `fonts.googleapis.com` during the build, or switch to `next/font/local` with
  the font files committed.
- **Remote images use plain `<img>`, not `next/image`.** Thumbnail and avatar
  hosts are deployment-configurable (Cloudinary, S3, dicebear and picsum in the
  seed data), and `next/image` throws at runtime on any host missing from
  `remotePatterns`. A broken thumbnail is a bad outcome; a crashed page is
  worse. If you settle on one storage host, add it to `next.config.mjs` and
  switch over to get optimisation back.
- **Data-fetch failures render inline, not through `error.tsx`.** The error
  boundary is a Client Component, so throwing during a server render streams an
  empty shell and the message only appears after hydration. Pages catch their
  own fetch failures and render an `Empty` state instead.
- **`hls.js` (~590 kB) is dynamically imported** inside the player, so it never
  enters the server bundle (it touches `window` on import) or any route but
  `/watch`.
- **Every route is dynamic** (`ƒ` in the build output). They all read cookies —
  caching a personalised feed would serve one user's recommendations to another.
- Playback falls back to native HLS on Safari/iOS, where loading hls.js on top
  would fight the built-in player.
- Heartbeats fire every 10s and once on `pagehide` via `sendBeacon`, which
  survives unload where `fetch` does not. Only forward playback accumulates, so
  scrubbing back doesn't inflate the watch ratio.
