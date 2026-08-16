"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import {
    panel,
    hDisplay,
    notice,
    noticeError,
    field,
    fieldLabel,
    fieldInput,
    fieldHint,
    btnPrimary,
    linkAccent,
} from "@/lib/ui";

export default function RegisterForm() {
    const { login } = useAuth();
    const router = useRouter();
    const [fields, setFields] = useState({
        fullName: "", username: "", email: "", password: "",
    });
    const [avatar, setAvatar] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setFields({ ...fields, [k]: e.target.value });

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!avatar) {
            setError("Pick an avatar image — the backend requires one.");
            return;
        }
        setBusy(true);
        setError(null);

        const form = new FormData();
        Object.entries(fields).forEach(([k, v]) => form.append(k, v));
        form.append("avatar", avatar);

        try {
            await api.register(form);
            await login({ username: fields.username, password: fields.password });
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create the account");
            setBusy(false);
        }
    };

    return (
        <div className={panel}>
            <h1 className={hDisplay + " text-[22px] mb-[22px]"}>
                Create an account
            </h1>

            {error && <div className={notice + " " + noticeError}>{error}</div>}

            <form onSubmit={submit}>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="fullName">Full name</label>
                    <input className={fieldInput} id="fullName" value={fields.fullName} onChange={set("fullName")} required />
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="ru">Username</label>
                    <input className={fieldInput} id="ru" value={fields.username} onChange={set("username")} required />
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="re">Email</label>
                    <input className={fieldInput} id="re" type="email" value={fields.email} onChange={set("email")} required />
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="rp">Password</label>
                    <input
                        className={fieldInput}
                        id="rp"
                        type="password"
                        value={fields.password}
                        onChange={set("password")}
                        autoComplete="new-password"
                        required
                    />
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="av">Avatar</label>
                    <input
                        className={fieldInput}
                        id="av"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
                        required
                    />
                    <p className={fieldHint}>JPEG, PNG or WebP.</p>
                </div>

                <button className={btnPrimary + " w-full justify-center"} disabled={busy}>
                    {busy ? "Creating account" : "Create account"}
                </button>
            </form>

            <p className="text-[13px] text-text-dim mt-[18px] mb-0">
                Already have one? <Link href="/login" className={linkAccent}>Sign in</Link>
            </p>
        </div>
    );
}
