/**
 * Sanitize a returnTo path to prevent open redirects.
 * Only allow same-site absolute paths (starting with "/").
 * Reject protocol-relative ("//"), URLs with ":[//]", and overly long inputs.
 */
export function sanitizeReturnTo(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;
    if (trimmed.startsWith('//')) return null;
    if (trimmed.includes('://')) return null;
    if (trimmed.length > 2048) return null;
    return trimmed;
}

export type SanitizeReturn = string | null;

