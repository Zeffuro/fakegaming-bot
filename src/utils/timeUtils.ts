import * as msImport from 'ms';

const ms = (msImport as any).default || msImport;

export function parseTimespan(timespan: string): number | null {
    const result = ms(timespan);
    return typeof result === 'number' && result > 0 ? result : null;
}

export function formatElapsed(ms: number): string {
    const secs = Math.floor(ms / 1000) % 60;
    const mins = Math.floor(ms / 1000 / 60) % 60;
    const hrs = Math.floor(ms / 1000 / 60 / 60) % 24;
    const days = Math.floor(ms / 1000 / 60 / 60 / 24);
    return `${days} day${days !== 1 ? 's' : ''}, ${hrs} hrs, ${mins} mins, ${secs} secs ago`;
}