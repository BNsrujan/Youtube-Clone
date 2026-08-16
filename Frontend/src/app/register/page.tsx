import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/api-server";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Create an account · videotube" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
    if (await isAuthenticated()) redirect("/");
    return <RegisterForm />;
}
