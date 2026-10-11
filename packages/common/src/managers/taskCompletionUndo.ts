interface CompletionSnapshot {
    version: number;
    dueAt: number | null;
    completedAt: number | null;
    completions: number;
    checklist: Array<{ text: string; done: boolean }>;
}

export function taskCompletionSnapshot(value: string | null | undefined, version: number): CompletionSnapshot | null {
    if (!value) return null;
    try {
        const snapshot: CompletionSnapshot = JSON.parse(value);
        const timestamp = (at: unknown) => at === null || (typeof at === 'number' && Number.isSafeInteger(at) && at >= 0);
        if (!snapshot || snapshot.version !== version || !timestamp(snapshot.dueAt) || !timestamp(snapshot.completedAt)
            || !Number.isSafeInteger(snapshot.completions) || snapshot.completions < 0
            || !Array.isArray(snapshot.checklist) || snapshot.checklist.length > 10
            || !snapshot.checklist.every(item => item && typeof item.text === 'string' && item.text.trim().length > 0
                && item.text.length <= 120 && typeof item.done === 'boolean')) return null;
        return snapshot;
    } catch { return null; }
}
