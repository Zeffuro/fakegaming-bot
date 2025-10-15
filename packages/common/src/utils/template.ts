/**
 * Render a simple token template replacing occurrences like {token} with provided values.
 * Missing tokens are replaced with an empty string.
 */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
    return template.replace(/\{([a-zA-Z0-9_:-]+)}/g, (_m, key: string) => {
        const val = vars[key];
        if (val == null) return '';
        return typeof val === 'string' ? val : String(val);
    });
}
