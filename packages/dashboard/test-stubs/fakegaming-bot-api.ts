// Minimal TypeScript stub for @zeffuro/fakegaming-bot-api to satisfy dynamic import in common testing utils.
// Test-only. Default export is required to match the real package's ESM shape.
export default async function createFakeApi() {
    return {
        start: async (): Promise<void> => undefined,
        stop: async (): Promise<void> => undefined,
    };
}

