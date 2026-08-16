"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { panel, hDisplay, notice, noticeError, field, fieldLabel, fieldInput, btnPrimary, linkAccent } from "@/lib/ui";

export default function LoginForm() {
    const { login } = useAuth();
    const router = useRouter();
    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await login(form);
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign in failed");
            setBusy(false);
        }
    };

    return (
        <div className={panel}>
            <h1 className={hDisplay + " text-[22px] mb-1.5"}>Sign in</h1>
            <p className="text-text-dim text-[13px] m-0 mb-[22px]">
                Seeded accounts: seeduser1 … seeduser20 / Password123!
            </p>

            {error && <div className={notice + " " + noticeError}>{error}</div>}

            <form onSubmit={submit}>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="username">Username</label>
                    <input
                        className={fieldInput}
                        id="username"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        autoComplete="username"
                        required
                    />
                </div>
                <div className={field}>
                    <label className={fieldLabel} htmlFor="password">Password</label>
                    <input
                        className={fieldInput}
                        id="password"
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        autoComplete="current-password"
                        required
                    />
                </div>
                <button className={btnPrimary + " w-full justify-center"} disabled={busy}>
                    {busy ? "Signing in" : "Sign in"}
                </button>
            </form>

            <p className="text-[13px] text-text-dim mt-[18px] mb-0">
                No account? <Link href="/register" className={linkAccent}>Create one</Link>
            </p>
        </div>
    );
}
