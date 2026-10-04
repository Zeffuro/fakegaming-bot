const downloads = new Map<string, { expiresAt: number; result: Promise<string | undefined> }>();

function isClipMediaUrl(url: URL): boolean {
    const host = url.hostname;
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && url.pathname.endsWith('.mp4')
        && (host.endsWith('.cloudfront.net') || host.endsWith('.clips.twitchcdn.net')
            || /^clips-media-assets\d*\.twitch\.tv$/.test(host));
}

async function resolveClipDownload(clipId: string): Promise<string | undefined> {
    try {
        // Undocumented player API: optional enrichment must never gate clip delivery.
        const response = await fetch('https://gql.twitch.tv/gql', {
            method: 'POST', headers: { 'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko', 'Content-Type': 'application/json' },
            body: JSON.stringify([{ operationName: 'VideoAccessToken_Clip', variables: { slug: clipId },
                extensions: { persistedQuery: { version: 1, sha256Hash: '36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11' } } }]),
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return undefined;
        const result = await response.json() as { data?: { clip?: {
            playbackAccessToken?: { signature?: string; value?: string };
            videoQualities?: { quality?: string; sourceURL?: string }[];
        } }; errors?: unknown[] }[];
        const clip = result[0]?.data?.clip;
        const token = clip?.playbackAccessToken;
        if (result[0]?.errors?.length || typeof token?.signature !== 'string' || !token.signature
            || typeof token.value !== 'string' || !token.value) return undefined;
        const formats = clip?.videoQualities?.filter(item => typeof item.sourceURL === 'string' && Number(item.quality) > 0)
            .sort((a, b) => Number(b.quality) - Number(a.quality));
        for (const format of formats ?? []) {
            if (!format.sourceURL) continue;
            const url = new URL(format.sourceURL);
            if (!isClipMediaUrl(url)) continue;
            url.searchParams.set('sig', token.signature);
            url.searchParams.set('token', token.value);
            if (url.href.length <= 900) return url.href;
        }
    } catch {
        return undefined;
    }
    return undefined;
}

export function getTwitchClipDownload(clipId: string): Promise<string | undefined> {
    if (!/^[a-zA-Z0-9_-]{1,255}$/.test(clipId)) return Promise.resolve(undefined);
    const cached = downloads.get(clipId);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    if (downloads.size >= 500) downloads.clear();
    const result = resolveClipDownload(clipId);
    downloads.set(clipId, { result, expiresAt: Date.now() + 60_000 });
    return result;
}
