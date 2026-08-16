"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

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
        <div className="panel">
            <h1 className="h-display" style={{ fontSize: 22, marginBottom: 6 }}>Sign in</h1>
            <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 22px" }}>
                Seeded accounts: seeduser1 … seeduser20 / Password123!
            </p>

            {error && <div className="notice notice-error">{error}</div>}

            <form onSubmit={submit}>
                <div className="field">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        autoComplete="username"
                        required
                    />
                </div>
                <div className="field">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        autoComplete="current-password"
                        required
                    />
                </div>
                <button
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={busy}
                >
                    {busy ? "Signing in" : "Sign in"}
                </button>
            </form>

            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "18px 0 0" }}>
                No account? <Link href="/register" className="link-accent">Create one</Link>
            </p>
        </div>
    );
}
