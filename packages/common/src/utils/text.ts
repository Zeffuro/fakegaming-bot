/**
 * Cleans up text for Discord by removing tabs, collapsing multiple newlines, and trimming whitespace.
 */
export function cleanDiscordContent(raw: string): string {
    let cleaned = raw.replace(/\t+/g, '');
    cleaned = cleaned.replace(/\n{2,}/g, '\n');
    cleaned = cleaned.trim();
    return cleaned;
}
