"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

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
        <div className="panel panel-wide">
            <h1 className="h-display" style={{ fontSize: 22, marginBottom: 6 }}>
                Upload a video
            </h1>
            <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 22px" }}>
                Tags drive content-based recommendations — a well-tagged video gets found on day
                one, before it has any watch history.
            </p>

            {error && <div className="notice notice-error">{error}</div>}

            <form onSubmit={submit}>
                <div className="field">
                    <label htmlFor="vf">Video file</label>
                    <input
                        id="vf"
                        type="file"
                        accept="video/*"
                        onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                        required
                    />
                    <p className="field-hint">MP4, WebM, MOV or MKV. Up to 500 MB.</p>
                </div>
                <div className="field">
                    <label htmlFor="ut">Title</label>
                    <input id="ut" value={fields.title} onChange={set("title")} required />
                </div>
                <div className="field">
                    <label htmlFor="ud">Description</label>
                    <textarea id="ud" value={fields.description} onChange={set("description")} required />
                </div>
                <div className="field">
                    <label htmlFor="utg">Tags</label>
                    <input
                        id="utg"
                        value={fields.tags}
                        onChange={set("tags")}
                        placeholder="react, tutorial, beginner"
                    />
                    <p className="field-hint">Comma separated. Up to 25.</p>
                </div>
                <div className="field">
                    <label htmlFor="uc">Category</label>
                    <select id="uc" value={fields.category} onChange={set("category")}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="field">
                    <label htmlFor="uv">Visibility</label>
                    <select id="uv" value={fields.visibility} onChange={set("visibility")}>
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                    </select>
                </div>
                <div className="field">
                    <label htmlFor="uth">Thumbnail</label>
                    <input
                        id="uth"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
                    />
                    <p className="field-hint">Optional — a poster frame is generated if you skip this.</p>
                </div>

                <button
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={busy}
                >
                    {busy ? "Uploading" : "Publish"}
                </button>
            </form>
        </div>
    );
}
