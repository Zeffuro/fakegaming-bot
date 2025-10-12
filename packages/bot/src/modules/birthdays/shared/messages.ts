export function subjectPossessive(targetUserId?: string | null): string {
    return targetUserId ? `<@${targetUserId}>'s` : 'Your';
}

export function subjectNominative(targetUserId?: string | null): string {
    return targetUserId ? `<@${targetUserId}>` : 'You';
}

// Backward-compatible alias used by existing imports
export const subjectForUser = subjectPossessive;
