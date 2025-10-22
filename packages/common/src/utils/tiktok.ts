/**
 * TikTok utilities (minimal)
 */

/** Sanitize a TikTok username by trimming and removing a leading @. */
export function sanitizeTikTokUsername(input: string): string {
    const v = (input ?? '').trim();
    return v.replace(/^@/, '');
}
