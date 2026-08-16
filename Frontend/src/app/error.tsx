"use client";

import { useEffect } from "react";
import { empty, emptyH3, emptyP, btnPrimary } from "@/lib/ui";

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
        <div className={empty}>
            <h3 className={emptyH3}>Something broke on this page</h3>
            <p className={emptyP}>{error.message}</p>
            <p className="m-0 mb-4 text-xs text-text-faint">
                If this persists, check the backend is running on port 8000.
            </p>
            <button className={btnPrimary} onClick={reset}>
                Try again
            </button>
        </div>
    );
}
