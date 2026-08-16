import Link from "next/link";
import { empty, emptyH3, emptyP, btnPrimary } from "@/lib/ui";

/** An empty screen is an invitation to act, not a dead end. */
export default function Empty({
    title,
    body,
    actionLabel,
    actionHref,
}: {
    title: string;
    body?: string;
    actionLabel?: string;
    actionHref?: string;
}) {
    return (
        <div className={empty}>
            <h3 className={emptyH3}>{title}</h3>
            {body && <p className={emptyP}>{body}</p>}
            {actionHref && actionLabel && (
                <Link className={btnPrimary} href={actionHref}>
                    {actionLabel}
                </Link>
            )}
        </div>
    );
}
