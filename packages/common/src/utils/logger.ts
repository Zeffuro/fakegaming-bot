import pino, { Logger as PinoLogger } from 'pino';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

let rootLogger: PinoLogger | null = null;

function createRootLogger(): PinoLogger {
    const level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

    const redact = {
        paths: [
            'password', 'secret', 'token', 'accessToken', 'refreshToken', 'jwt',
            'authorization', 'Authorization', 'cookie', 'Cookie', 'set-cookie', 'Set-Cookie',
            '*.password', '*.secret', '*.token', '*.accessToken', '*.refreshToken', '*.jwt'
        ] as string[],
        censor: '[redacted]'
    };

    return pino({ level, redact });
}

/**
 * Get the shared process logger, optionally with a child name.
 */
export function getLogger(opts?: { name?: string }): PinoLogger {
    if (!rootLogger) rootLogger = createRootLogger();
    return opts?.name ? rootLogger.child({ name: opts.name }) : rootLogger;
}

/**
 * Create a child logger from the shared root with a required name and optional bindings.
 */
export function createChildLogger(name: string, bindings?: Record<string, unknown>): PinoLogger {
    const base = getLogger();
    const childBindings = bindings ? { name, ...bindings } : { name };
    return base.child(childBindings);
}

/**
 * Set the global logger level at runtime.
 */
export function setLoggerLevel(level: LogLevel): void {
    if (!rootLogger) rootLogger = createRootLogger();
    rootLogger.level = level;
}
