import { bootstrapEnv } from '@zeffuro/fakegaming-common/core';

// Next.js server instrumentation runs before the app starts.
// Ensure .env is loaded so the shared logger can enable pino-pretty when LOG_PRETTY=1.
export async function register() {
    bootstrapEnv(import.meta.url);
}

