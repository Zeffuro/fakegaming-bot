"use client";
import { useCallback, useState } from "react";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

/**
 * useAsyncTask centralizes common async action state for small admin tools.
 * It provides a stable run() that captures result or error and manages submitting.
 */
export function useAsyncTask<T>() {
    const { t } = useDashboardI18n();
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
            const msg = e instanceof Error ? e.message : t("hooks.operationFailed");
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }, [t]);

    return { submitting, result, error, setError, reset, run } as const;
}
