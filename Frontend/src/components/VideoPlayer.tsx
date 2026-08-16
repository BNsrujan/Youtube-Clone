"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type Hls from "hls.js";
import { api } from "@/lib/api-client";
import { bitrate as fmtBitrate, duration as fmtDuration } from "@/lib/format";
import type { PlaybackManifest } from "@/types";

/**
 * The player. Necessarily a Client Component — it owns a media element, a
 * bitrate algorithm, and a heartbeat timer, none of which exist on the server.
 *
 * Three responsibilities, and the last two are why this looks different from a
 * plain <video>:
 *
 *   1. Attach HLS.js (or native HLS on Safari) to the master playlist
 *   2. Surface what the adaptive bitrate logic is doing, live
 *   3. Send watch heartbeats — the signal the whole recommender is built on
 *
 * The telemetry strip exists because bitrate switching is normally invisible.
 * Showing the active rung, measured throughput and buffer depth turns an opaque
 * mechanism into something you can watch working, and debug when it isn't.
 */

interface LevelInfo {
    height: number;
    bitrate: number;
}

interface Telemetry {
    level: number;
    levels: LevelInfo[];
    bandwidth: number;
    buffer: number;
    auto: boolean;
}

export default function VideoPlayer({
    videoId,
    source = "direct",
    rankPosition,
}: {
    videoId: string;
    source?: string;
    rankPosition?: number;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    const [manifest, setManifest] = useState<PlaybackManifest | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [telemetry, setTelemetry] = useState<Telemetry>({
        level: -1,
        levels: [],
        bandwidth: 0,
        buffer: 0,
        auto: true,
    });

    // Watch accounting lives in refs: timeupdate fires ~4x a second and
    // re-rendering that often would be pure waste.
    const watchedRef = useRef(0);
    const lastTimeRef = useRef(0);
    const [watchRatio, setWatchRatio] = useState(0);

    // ------------------------------------------------------------ manifest
    useEffect(() => {
        let cancelled = false;

        setManifest(null);
        setError(null);
        watchedRef.current = 0;
        lastTimeRef.current = 0;
        setWatchRatio(0);

        api.manifest(videoId)
            .then((data) => {
                if (!cancelled) setManifest(data);
            })
            .catch((err: { status?: number; message: string }) => {
                if (cancelled) return;
                setError(
                    err.status === 409
                        ? "This video is still processing. Check back in a few minutes."
                        : err.message
                );
            });

        return () => {
            cancelled = true;
        };
    }, [videoId]);

    // ----------------------------------------------------------------- HLS
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !manifest?.masterPlaylistUrl) return;

        const url = manifest.masterPlaylistUrl;

        // Safari and iOS play HLS natively; loading hls.js on top fights it.
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            video.currentTime = manifest.resumeAt || 0;
            return;
        }

        // hls.js is ~590 kB. Importing it dynamically keeps it out of every
        // bundle except the one a viewer actually needs — and out of the
        // server bundle entirely, since it touches window on import.
        let destroyed = false;
        let hls: Hls | null = null;

        void import("hls.js").then(({ default: HlsCtor }) => {
            if (destroyed || !videoRef.current) return;

            if (!HlsCtor.isSupported()) {
                setError("This browser can't play HLS. Try Chrome, Firefox, or Safari.");
                return;
            }

            hls = new HlsCtor({
                // Start conservatively and let ABR climb. Opening on the top
                // rung means a stall on the first segment for anyone on
                // mobile data.
                startLevel: -1,
                maxBufferLength: 30,
                capLevelToPlayerSize: true,
            });
            hlsRef.current = hls;

            hls.loadSource(url);
            hls.attachMedia(videoRef.current);

            hls.on(HlsCtor.Events.MANIFEST_PARSED, (_e, data) => {
                setTelemetry((t) => ({
                    ...t,
                    levels: data.levels.map((l) => ({
                        height: l.height,
                        bitrate: l.bitrate,
                    })),
                }));
                if (manifest.resumeAt && videoRef.current) {
                    videoRef.current.currentTime = manifest.resumeAt;
                }
            });

            // The event the telemetry strip exists to show.
            hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_e, data) => {
                setTelemetry((t) => ({ ...t, level: data.level }));
            });

            hls.on(HlsCtor.Events.FRAG_BUFFERED, () => {
                const el = videoRef.current;
                if (!el || !hls) return;
                const buffered = el.buffered.length
                    ? el.buffered.end(el.buffered.length - 1) - el.currentTime
                    : 0;
                setTelemetry((t) => ({
                    ...t,
                    bandwidth: hls?.bandwidthEstimate ?? 0,
                    buffer: Math.max(0, buffered),
                    auto: hls?.autoLevelEnabled ?? true,
                }));
            });

            hls.on(HlsCtor.Events.ERROR, (_e, data) => {
                if (!data.fatal || !hls) return;
                // Network and media errors are usually transient and hls.js
                // can recover from both. Only tear down if recovery fails.
                if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
                    hls.startLoad();
                } else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                } else {
                    setError("Playback failed. Reload the page to try again.");
                    hls.destroy();
                }
            });
        });

        return () => {
            destroyed = true;
            hls?.destroy();
            hlsRef.current = null;
        };
    }, [manifest]);

    // ----------------------------------------------------------- heartbeat
    const sendProgress = useCallback(
        (useBeacon = false) => {
            const video = videoRef.current;
            if (!video || !manifest) return;

            const payload = {
                positionSeconds: video.currentTime,
                watchedSeconds: watchedRef.current,
                source,
                ...(rankPosition !== undefined ? { rankPosition } : {}),
            };

            // sendBeacon survives page unload; fetch does not.
            if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
                navigator.sendBeacon(
                    `/api/v1/stream/${videoId}/progress`,
                    new Blob([JSON.stringify(payload)], { type: "application/json" })
                );
            } else {
                void api.progress(videoId, payload).catch(() => {
                    // A dropped heartbeat isn't worth interrupting playback for.
                });
            }
        },
        [videoId, manifest, source, rankPosition]
    );

    useEffect(() => {
        if (!manifest) return;

        const interval = setInterval(() => sendProgress(false), 10_000);
        const onHide = () => sendProgress(true);

        window.addEventListener("pagehide", onHide);
        return () => {
            clearInterval(interval);
            window.removeEventListener("pagehide", onHide);
            sendProgress(true); // navigating away still ends a session
        };
    }, [manifest, sendProgress]);

    // Only forward movement accumulates, so scrubbing back and rewatching a
    // section doesn't inflate the ratio the recommender learns from.
    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video) return;

        const delta = video.currentTime - lastTimeRef.current;
        if (delta > 0 && delta < 2) watchedRef.current += delta;
        lastTimeRef.current = video.currentTime;

        if (manifest?.duration) {
            setWatchRatio(Math.min(watchedRef.current / manifest.duration, 1));
        }
    };

    const setQuality = (levelIndex: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex; // -1 restores auto
            setTelemetry((t) => ({ ...t, auto: levelIndex === -1 }));
        }
    };

    // -------------------------------------------------------------- render
    if (error) {
        return (
            <div className="stage" style={{ display: "grid", placeItems: "center" }}>
                <p style={{ margin: 0, padding: 30, color: "var(--text-dim)", textAlign: "center" }}>
                    {error}
                </p>
            </div>
        );
    }

    const active = telemetry.levels[telemetry.level];
    const viewCounted = watchRatio >= 0.3;

    return (
        <>
            <div className="stage">
                <video ref={videoRef} controls playsInline onTimeUpdate={handleTimeUpdate} />
            </div>

            <div className="telemetry" aria-label="Playback telemetry">
                <div className="tel-cell">
                    <span className="tel-k">Rendition</span>
                    <span className="tel-v" style={{ color: "var(--sig-engagement)" }}>
                        {active ? `${active.height}p` : "—"}
                        {telemetry.auto && <span style={{ color: "var(--text-faint)" }}> auto</span>}
                    </span>
                </div>

                <div className="tel-cell">
                    <span className="tel-k">Ladder</span>
                    <div className="ladder" role="img" aria-label="Bitrate ladder position">
                        {telemetry.levels
                            .map((l, i) => ({ ...l, i }))
                            .sort((a, b) => a.height - b.height)
                            .map((l) => (
                                <div
                                    key={l.i}
                                    className={`rung${l.i === telemetry.level ? " on" : ""}`}
                                    style={{ height: `${6 + (l.height / 1080) * 11}px` }}
                                    title={`${l.height}p · ${fmtBitrate(l.bitrate)}`}
                                />
                            ))}
                    </div>
                </div>

                <div className="tel-cell">
                    <span className="tel-k">Throughput</span>
                    <span className="tel-v">{fmtBitrate(telemetry.bandwidth)}</span>
                </div>

                <div className="tel-cell">
                    <span className="tel-k">Buffer</span>
                    <span className="tel-v">{telemetry.buffer.toFixed(1)}s</span>
                </div>

                <div className="tel-cell">
                    <span className="tel-k">Watched</span>
                    <span className="tel-v">
                        {(watchRatio * 100).toFixed(0)}%
                        <span
                            style={{
                                marginLeft: 6,
                                color: viewCounted ? "var(--ok)" : "var(--text-faint)",
                            }}
                        >
                            {viewCounted ? "view counted" : "below 30%"}
                        </span>
                    </span>
                </div>

                {manifest && manifest.resumeAt > 0 && (
                    <div className="tel-cell">
                        <span className="tel-k">Resumed</span>
                        <span className="tel-v">{fmtDuration(manifest.resumeAt)}</span>
                    </div>
                )}

                <div className="tel-cell grow">
                    <span className="tel-k">Quality</span>
                    <select
                        className="quality-select"
                        value={telemetry.auto ? -1 : telemetry.level}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        aria-label="Video quality"
                    >
                        <option value={-1}>auto</option>
                        {telemetry.levels.map((l, i) => (
                            <option key={i} value={i}>
                                {l.height}p
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </>
    );
}
