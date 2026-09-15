"use client";

import { useState } from "react";
import { infoBox } from "@/lib/ui";

/**
 * The description box.
 *
 * Purely presentational — it takes the strings the server already rendered and
 * adds the collapse. Two lines when shut, the whole thing when open, and the
 * box itself is the expand target so there's no hunting for the link.
 */
export default function Description({
    meta,
    text,
    children,
}: {
    meta: string;
    text?: string;
    children?: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div
            className={infoBox + " mt-3" + (open ? "" : " cursor-pointer hover:bg-surface-3 transition-colors duration-100")}
            onClick={() => !open && setOpen(true)}
        >
            <p className="m-0 text-[13px] font-medium">{meta}</p>

            {text && (
                <p
                    className={
                        "mt-2 mb-0 text-sm whitespace-pre-wrap break-words " +
                        (open ? "" : "line-clamp-2")
                    }
                >
                    {text}
                </p>
            )}

            {open && children}

            {text && (
                <button
                    type="button"
                    className="mt-2 text-sm font-medium text-text bg-transparent border-0 p-0 cursor-pointer hover:underline"
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpen((o) => !o);
                    }}
                    aria-expanded={open}
                >
                    {open ? "Show less" : "...more"}
                </button>
            )}
        </div>
    );
}
