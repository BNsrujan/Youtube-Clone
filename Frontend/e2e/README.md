# End-to-end tests

Playwright drives the real stack: a real Express server against MongoDB, and a
real Next.js server rendering Server Components. Nothing is stubbed, because the
parts most worth testing here — the session cookie read during SSR, the feed
arriving in the initial HTML, the `/api` rewrite — only exist when both servers
are actually running.

## Running

```bash
cd Frontend
npm run test:e2e            # headless, starts both servers itself
npm run test:e2e:ui         # interactive runner
npm run test:e2e:headed     # watch it drive a real browser
npm run test:e2e:report     # open the last HTML report
```

Playwright starts the servers for you and shuts them down afterwards.

## Ports

The suite uses **3100** (frontend) and **8100** (backend), not 3000/8000. Those
defaults are frequently taken by other projects on a dev machine, and a suite
that quietly tests a different app is worse than one that refuses to start.

Override if you need to:

```bash
E2E_FRONTEND_PORT=4000 E2E_BACKEND_PORT=9000 npm run test:e2e
```

To run against servers you started yourself:

```bash
E2E_NO_SERVER=1 npm run test:e2e
```

## Data

Tests read from whatever is in the database and **skip** rather than fail when
it is empty, so a fresh clone does not produce a wall of red. To get real,
playable content:

```bash
cd Backend
npm run seed:media          # pulls openly-licensed video, uploads to Cloudinary
npm run jobs                # similarity matrix, taste profiles, trending scores
```

Seeded accounts are `orbitlab`, `quietmachines`, … / `Password123!`.

## What is covered

| Spec | Covers |
|---|---|
| `api.spec.ts` | ApiResponse envelope, auth gating, JSON error shape, the Next `/api` rewrite |
| `home.spec.ts` | Cold-start vs personalised feed, SSR content in raw HTML, scoring toggle as URL state |
| `navigation.spec.ts` | Header surface, search routing, empty states, 404s, malformed ids |
| `trending.spec.ts` | Ranking readout, category filter round-tripping through the URL |
| `auth.spec.ts` | Login/logout, bad credentials, session surviving a hard reload, gated routes |
| `watch.spec.ts` | Player + ABR telemetry, **HLS manifest actually resolving**, tabs, comments, likes, click attribution |

## Notes on how these are written

- **Serial, single worker.** The backend is shared, stateful, and a comment
  written by one test is visible to every other. Parallelism here buys speed and
  pays for it in flakes.
- **Assertions target behaviour, not fixtures.** Titles come from a live
  recommender over real content, so tests assert on structure, roles and URL
  state rather than specific video names.
- **Mutations clean up after themselves** — the comment test deletes its
  comment, the like test toggles back.
