import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/api-server";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · videotube" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
    // Already signed in — no reason to show the form.
    if (await isAuthenticated()) redirect("/");
    return <LoginForm />;
}
