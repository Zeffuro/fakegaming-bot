export function parseCompletedTime(input: string, timezone: string, now = Date.now()): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(input.trim());
    if (!match || !Number.isFinite(now)) return null;
    const [year, month, day, hour, minute, second] = match.slice(1, 7).map(value => Number(value ?? 0));
    const naive = Date.UTC(year!, month! - 1, day, hour, minute, second);
    const date = new Date(naive);
    if (year! < 1970 || hour! > 23 || minute! > 59 || second! > 59 || date.getUTCFullYear() !== year
        || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    let formatter: Intl.DateTimeFormat;
    try {
        formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    } catch { return null; }
    const wallUtc = (timestamp: number) => {
        const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
        return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    };
    let timestamp: number | undefined;
    if (match[7]) {
        timestamp = Date.parse(input.trim().replace(' ', 'T'));
    } else {
        const candidates = new Set<number>();
        for (const hours of [-36, -12, 0, 12, 36]) {
            const probe = naive + hours * 3_600_000;
            const candidate = naive - (wallUtc(probe) - probe);
            if (wallUtc(candidate) === naive) candidates.add(candidate);
        }
        if (candidates.size === 1) timestamp = [...candidates][0];
    }
    return timestamp !== undefined && Number.isSafeInteger(timestamp) && timestamp <= now ? timestamp : null;
}
