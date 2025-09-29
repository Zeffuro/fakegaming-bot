import { apiFetch } from "./apiFetch";

export function getApiUrl(): string {
    return (
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.API_URL ||
        "/api"
    );
}

export class ApiClient {
    constructor(private token?: string) {}

    get<T>(path: string, init: RequestInit = {}) {
        let apiPath = `${getApiUrl()}${path}`;
        console.log("Fetching from:", apiPath);
        return apiFetch<T>(apiPath, init, this.token);
    }

    post<T>(path: string, body: any, init: RequestInit = {}) {
        let apiPath = `${getApiUrl()}${path}`;
        console.log("Fetching from:", apiPath);
        return apiFetch<T>(
            apiPath,
            {
                ...init,
                method: "POST",
                body: JSON.stringify(body),
                headers: { "Content-Type": "application/json", ...init.headers },
            },
            this.token
        );
    }

    // Add put, delete, etc. as needed!
}