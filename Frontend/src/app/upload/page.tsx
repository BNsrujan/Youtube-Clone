import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/api-server";
import UploadForm from "./UploadForm";

export const metadata: Metadata = { title: "Upload · videotube" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
    // Guarded on the server: an unauthenticated visitor never receives the
    // form markup at all, rather than being bounced after hydration.
    if (!(await isAuthenticated())) redirect("/login");
    return <UploadForm />;
}
