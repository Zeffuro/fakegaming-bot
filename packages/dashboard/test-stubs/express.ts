// Minimal TypeScript stub for 'express' to satisfy Vitest import analysis from common testing utils.
// Test-only; provides default export function and a json() middleware.
function express() {
    return {
        use: (_mw: unknown): void => undefined,
    } as const;
}

// Provide a json middleware stub compatible with Express' signature
(express as any).json = () => {
    return (_req: unknown, _res: unknown, next: unknown): void => {
        if (typeof next === 'function') {
            (next as () => void)();
        }
    };
};

export default express;

