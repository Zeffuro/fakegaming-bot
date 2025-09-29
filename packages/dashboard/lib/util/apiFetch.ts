export async function apiFetch<T>(
    input: RequestInfo,
    init: RequestInit = {},
    token?: string
): Promise<T> {
    const headers = new Headers(init.headers || {});
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(input, { ...init, headers });
    if (!res.ok) {
        const rawText = await res.text();
        let errorMessage: string = rawText || `HTTP error ${res.status}`;
        try {
            const parsed = JSON.parse(rawText);
            errorMessage = typeof parsed === 'string' ? parsed : (parsed.message || JSON.stringify(parsed));
        } catch {
            // Not JSON, keep as text
        }
        const error = new Error(errorMessage);
        // @ts-ignore
        error.status = res.status;
        throw error;
    }
    return await res.json() as T;
}