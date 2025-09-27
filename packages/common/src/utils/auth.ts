// Automatic dashboard authentication utility

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const CLIENT_ID = process.env.NEXT_PUBLIC_DASHBOARD_CLIENT_ID || process.env.DASHBOARD_CLIENT_ID || 'dashboard';
const CLIENT_SECRET = process.env.NEXT_PUBLIC_DASHBOARD_CLIENT_SECRET || process.env.DASHBOARD_CLIENT_SECRET || '';

export async function getJwt(): Promise<string | null> {
    // Try to get JWT from localStorage
    let token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    if (token) return token;

    // Authenticate with API using env vars
    const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({clientId: CLIENT_ID, clientSecret: CLIENT_SECRET}),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.token) {
        localStorage.setItem('jwt', data.token);
        return data.token;
    }
    return null;
}

