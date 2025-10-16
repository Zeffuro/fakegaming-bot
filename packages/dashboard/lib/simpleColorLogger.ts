// Lightweight, dependency-free colorized console logger for Next.js server routes
// Safe for Next dev workers: does not import pino or any transports.

export type SimpleLogger = {
    info: (obj?: unknown, msg?: string) => void;
    warn: (obj?: unknown, msg?: string) => void;
    error: (obj?: unknown, msg?: string) => void;
    debug: (obj?: unknown, msg?: string) => void;
    trace: (obj?: unknown, msg?: string) => void;
};

const COLORS = {
    reset: '\u001b[0m',
    dim: '\u001b[2m',
    gray: '\u001b[90m',
    red: '\u001b[31m',
    yellow: '\u001b[33m',
    green: '\u001b[32m',
    cyan: '\u001b[36m',
    magenta: '\u001b[35m',
};

const LEVELS = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 } as const;

type LevelKey = keyof typeof LEVELS;

function currentMinLevel(): number {
    const env = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase();
    const key = (['fatal','error','warn','info','debug','trace'] as LevelKey[]).includes(env as LevelKey) ? env as LevelKey : 'debug';
    return LEVELS[key];
}

function shouldLog(level: LevelKey, min: number): boolean {
    return LEVELS[level] >= min;
}

function fmt(level: keyof SimpleLogger, name: string, msg?: string): string {
    const pretty = typeof process !== 'undefined' && process.env.LOG_PRETTY === '1';
    if (!pretty) return msg ?? '';

    const levelColor = (
        level === 'error' ? COLORS.red :
        level === 'warn' ? COLORS.yellow :
        level === 'info' ? COLORS.green :
        level === 'debug' ? COLORS.magenta :
        COLORS.gray
    );
    const mode = (process.env.LOG_PRETTY_MODE || 'short').toLowerCase();
    const ts = new Date().toISOString();
    const base = `${levelColor}${level.toUpperCase()}${COLORS.reset} ${COLORS.cyan}${name}${COLORS.reset}`;
    if (mode === 'expanded') {
        return `${COLORS.dim}${ts}${COLORS.reset} ${base}${msg ? ' ' + msg : ''}`;
    }
    return `${base}${msg ? ' ' + msg : ''}`;
}

function logPair(consoleFn: (message?: unknown, ...optionalParams: unknown[]) => void, line: string, obj?: unknown) {
    if (obj !== undefined) consoleFn(line, obj);
    else consoleFn(line);
}

/**
 * Create a minimal colorized logger for environments that can't use pino transports (e.g., Next dev workers).
 */
export function createSimpleLogger(name: string): SimpleLogger {
    const min = currentMinLevel();
    return {
        info: (obj?: unknown, msg?: string) => { if (shouldLog('info', min)) logPair(console.info, fmt('info', name, msg), obj); },
        warn: (obj?: unknown, msg?: string) => { if (shouldLog('warn', min)) logPair(console.warn, fmt('warn', name, msg), obj); },
        error: (obj?: unknown, msg?: string) => { if (shouldLog('error', min)) logPair(console.error, fmt('error', name, msg), obj); },
        debug: (obj?: unknown, msg?: string) => { if (shouldLog('debug', min)) logPair(console.debug, fmt('debug', name, msg), obj); },
        trace: (obj?: unknown, msg?: string) => { if (shouldLog('trace', min)) logPair(console.debug, fmt('trace', name, msg), obj); },
    };
}
