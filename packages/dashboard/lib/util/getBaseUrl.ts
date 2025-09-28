import type {NextRequest} from "next/server";

export function getBaseUrl(req?: NextRequest): string {
    const envUrl =
        process.env.NEXT_PUBLIC_PUBLIC_URL ||
        process.env.PUBLIC_URL ||
        "";

    if (envUrl) {
        return envUrl.replace(/\/$/, "");
    }

    if (req) {
        const host =
            req.headers.get("x-forwarded-host") ??
            req.headers.get("host") ??
            "localhost:3000";

        const proto =
            req.headers.get("x-forwarded-proto") ??
            (host.startsWith("localhost") ? "http" : "https");

        return `${proto}://${host}`;
    }

    return "http://localhost:3000";
}