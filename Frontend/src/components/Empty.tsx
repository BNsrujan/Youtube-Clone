import Link from "next/link";

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
        <div className="empty">
            <h3>{title}</h3>
            {body && <p>{body}</p>}
            {actionHref && actionLabel && (
                <Link className="btn btn-primary" href={actionHref}>
                    {actionLabel}
                </Link>
            )}
        </div>
    );
}
