"use client";

import { useEffect } from "react";

/** Route error boundary. States what broke and offers the one useful action. */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="empty">
            <h3>Something broke on this page</h3>
            <p>{error.message}</p>
            <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                If this persists, check the backend is running on port 8000.
            </p>
            <button className="btn btn-primary" onClick={reset}>
                Try again
            </button>
        </div>
    );
}
