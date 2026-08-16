"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import {
    panelWide,
    hDisplay,
    notice,
    noticeError,
    field,
    fieldLabel,
    fieldInput,
    fieldTextarea,
    fieldHint,
    btnPrimary,
} from "@/lib/ui";

const CATEGORIES = [
    "education", "music", "gaming", "news", "sports",
    "tech", "comedy", "film", "howto", "travel", "other",
];

export default function UploadForm() {
    const router = useRouter();
    const [fields, setFields] = useState({
        title: "", description: "", tags: "", category: "other", visibility: "public",
    });
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const set =
        (k: keyof typeof fields) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
            setFields({ ...fields, [k]: e.target.value });

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!videoFile) {
            setError("Choose a video file to upload.");
            return;
        }
        setBusy(true);
        setError(null);

        const form = new FormData();
        Object.entries(fields).forEach(([k, v]) => form.append(k, v));
        form.append("videoFile", videoFile);
        if (thumbnail) form.append("thumbnail", thumbnail);

        try {
            const video = await api.publish(form);
            router.push(`/watch/${video._id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
            setBusy(false);
        }
    };

    return (
        <div className={panelWide}>
            <h1 className={hDisplay + " text-[22px] mb-1.5"}>
                Upload a video
            </h1>
            <p className="text-text-dim text-[13px] m-0 mb-[22px]">
                Tags drive content-based recommendations — a well-tagged video gets found on day
                one, before it has any watch history.
            </p>

            {error && <div className={notice + " " + noticeError}>{error}</div>}

            <form onSubmit={submit}>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="vf">Video file</label>
                    <input
                        className={fieldInput}
                        id="vf"
                        type="file"
                        accept="video/*"
                        onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                        required
                    />
                    <p className={fieldHint}>MP4, WebM, MOV or MKV. Up to 500 MB.</p>
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="ut">Title</label>
                    <input className={fieldInput} id="ut" value={fields.title} onChange={set("title")} required />
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="ud">Description</label>
                    <textarea className={fieldTextarea} id="ud" value={fields.description} onChange={set("description")} required />
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="utg">Tags</label>
                    <input
                        className={fieldInput}
                        id="utg"
                        value={fields.tags}
                        onChange={set("tags")}
                        placeholder="react, tutorial, beginner"
                    />
                    <p className={fieldHint}>Comma separated. Up to 25.</p>
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="uc">Category</label>
                    <select className={fieldInput} id="uc" value={fields.category} onChange={set("category")}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="uv">Visibility</label>
                    <select className={fieldInput} id="uv" value={fields.visibility} onChange={set("visibility")}>
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                    </select>
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="uth">Thumbnail</label>
                    <input
                        className={fieldInput}
                        id="uth"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
                    />
                    <p className={fieldHint}>Optional — a poster frame is generated if you skip this.</p>
                </div>

                <button className={btnPrimary + " w-full justify-center"} disabled={busy}>
                    {busy ? "Uploading" : "Publish"}
                </button>
            </form>
        </div>
    );
}
