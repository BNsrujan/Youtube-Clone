import { GridSkeleton } from "@/components/VideoGrid";
import { feedHead, skeleton } from "@/lib/ui";

/** Route-level loading UI. Shown instantly on navigation while the server
 *  renders — the reason a Next.js page transition doesn't feel like a stall. */
export default function Loading() {
    return (
        <>
            <div className={feedHead}>
                <div className={skeleton + " w-[180px] h-[26px]"} />
            </div>
            <GridSkeleton />
        </>
    );
}
