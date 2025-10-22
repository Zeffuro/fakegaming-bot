"use client";
import { useCallback, useState } from "react";

/**
 * useAsyncTask centralizes common async action state for small admin tools.
 * It provides a stable run() that captures result or error and manages submitting.
 */
export function useAsyncTask<T>() {
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [result, setResult] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
        setSubmitting(false);
    }, []);

    const run = useCallback(async (fn: () => Promise<T>) => {
        setSubmitting(true);
        setError(null);
        setResult(null);
        try {
            const res = await fn();
            setResult(res);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Operation failed";
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }, []);

    return { submitting, result, error, setError, reset, run } as const;
}
