export interface PersonalTwitchStream { id: string; user_login: string; user_name: string; title: string; started_at: string }
export interface PersonalTwitchUser { id: string; login: string; display_name: string }
let cachedToken: { value: string; expiresAt: number } | null = null;
let pendingToken: Promise<string> | null = null;

async function token(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
    if (pendingToken) return pendingToken;
    pendingToken = (async () => {
        const clientId = process.env.TWITCH_CLIENT_ID;
        const clientSecret = process.env.TWITCH_CLIENT_SECRET;
        if (!clientId || !clientSecret) throw new Error('twitch-not-configured');
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST', body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`twitch-auth-${response.status}`);
        const data = await response.json() as { access_token?: unknown; expires_in?: unknown };
        if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('invalid-twitch-token');
        cachedToken = { value: data.access_token, expiresAt: Date.now() + (typeof data.expires_in === 'number' ? data.expires_in : 3600) * 1000 };
        return data.access_token;
    })();
    try { return await pendingToken; } finally { pendingToken = null; }
}

async function request(path: string, parameters: URLSearchParams): Promise<unknown[]> {
    const response = await fetch(`https://api.twitch.tv/helix/${path}?${parameters}`, {
        headers: { Authorization: `Bearer ${await token()}`, 'Client-Id': process.env.TWITCH_CLIENT_ID! }, signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401) cachedToken = null;
    if (!response.ok) throw new Error(`twitch-${response.status}`);
    const data = await response.json() as { data?: unknown };
    if (!Array.isArray(data.data)) throw new Error('invalid-twitch-response');
    return data.data;
}

export async function findPersonalTwitchUser(login: string): Promise<PersonalTwitchUser | null> {
    const normalized = login.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{1,25}$/.test(normalized)) return null;
    const users = await request('users', new URLSearchParams({ login: normalized }));
    const user = users.find(value => typeof value === 'object' && value !== null && 'login' in value && value.login === normalized);
    return user && typeof user === 'object' && 'id' in user && typeof user.id === 'string' && 'display_name' in user && typeof user.display_name === 'string'
        ? user as PersonalTwitchUser : null;
}

export async function fetchPersonalTwitchStreams(logins: readonly string[]): Promise<PersonalTwitchStream[]> {
    const unique = [...new Set(logins)].filter(login => /^[a-z0-9_]{1,25}$/.test(login));
    const streams: PersonalTwitchStream[] = [];
    for (let index = 0; index < unique.length; index += 100) {
        const parameters = new URLSearchParams({ first: '100' });
        for (const login of unique.slice(index, index + 100)) parameters.append('user_login', login);
        const data = await request('streams', parameters);
        for (const value of data) {
            if (typeof value !== 'object' || value === null) continue;
            const stream = value as Partial<PersonalTwitchStream>;
            if (typeof stream.id === 'string' && typeof stream.user_login === 'string' && typeof stream.user_name === 'string'
                && typeof stream.title === 'string' && typeof stream.started_at === 'string' && unique.includes(stream.user_login)
                && Number.isFinite(Date.parse(stream.started_at))) streams.push(stream as PersonalTwitchStream);
        }
    }
    return streams;
}
