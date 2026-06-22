const TEST_ENV_FALLBACKS: Record<string, string> = {
    JWT_SECRET: 'testsecret',
    JWT_AUDIENCE: 'fakegaming-dashboard',
    JWT_ISSUER: 'fakegaming',
};

interface RequireEnvOptions {
    allowTestFallback?: boolean;
    prefix?: string;
}

export function requireEnv(name: string, options: RequireEnvOptions = {}): string {
    const value = process.env[name];
    if (value && value.trim() !== '') {
        return value;
    }

    if (options.allowTestFallback === true && process.env.NODE_ENV === 'test') {
        const fallback = TEST_ENV_FALLBACKS[name];
        if (fallback) {
            return fallback;
        }
    }

    const prefix = options.prefix ? `[${options.prefix}] ` : '';
    throw new Error(`${prefix}Missing required environment variable: ${name}`);
}

