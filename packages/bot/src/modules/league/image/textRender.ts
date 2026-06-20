export const DEFAULT_HISTORY_FONT_FAMILY = '"Roboto", Arial, sans-serif';

export function historyFontString({
    size = 14,
    weight = '',
    family = DEFAULT_HISTORY_FONT_FAMILY
}: {
    size?: number;
    weight?: string;
    family?: string;
} = {}): string {
    return `${weight ? `${weight} ` : ''}${size}px ${family}`.trim();
}
