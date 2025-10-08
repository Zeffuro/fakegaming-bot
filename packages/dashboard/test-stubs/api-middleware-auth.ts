// Minimal TypeScript stub for @zeffuro/fakegaming-bot-api/middleware/auth used by common testing utils.
// Test-only. Exports a jwtAuth middleware that just calls next().
export function jwtAuth(req: unknown, res: unknown, next: unknown): void {
    if (typeof next === 'function') {
        (next as () => void)();
    }
}

