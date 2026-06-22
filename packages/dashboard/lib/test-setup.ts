// React 19+ testing environment flag for act(...)
// See: https://react.dev/reference/react/act#testing-environments
// This ensures React knows we are in a testing environment and suppresses the warning.
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Ensure required JWT env vars exist during tests
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
    process.env.JWT_SECRET = 'testsecret';
}
if (!process.env.JWT_AUDIENCE || process.env.JWT_AUDIENCE.trim() === '') {
    process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
}
if (!process.env.JWT_ISSUER || process.env.JWT_ISSUER.trim() === '') {
    process.env.JWT_ISSUER = 'fakegaming';
}

if (!process.env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID.trim() === '') {
    process.env.DISCORD_CLIENT_ID = 'test-discord-client-id';
}
if (!process.env.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET.trim() === '') {
    process.env.DISCORD_CLIENT_SECRET = 'test-discord-client-secret';
}
