import { GridSkeleton } from "@/components/VideoGrid";

/** Route-level loading UI. Shown instantly on navigation while the server
 *  renders — the reason a Next.js page transition doesn't feel like a stall. */
export default function Loading() {
    return (
        <>
            <div className="feed-head">
                <div className="skeleton sk-line" style={{ width: 180, height: 26 }} />
            </div>
            <GridSkeleton />
        </>
    );
}
