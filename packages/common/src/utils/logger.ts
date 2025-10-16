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

    // Detect Next.js runtime (app router route handlers set NEXT_RUNTIME)
    const inNextRuntime = typeof process !== 'undefined' && typeof process.env.NEXT_RUNTIME === 'string' && process.env.NEXT_RUNTIME.length > 0;

    // Pretty mode can be forced via LOG_PRETTY=1 (overrides NODE_ENV),
    // but it's disabled automatically inside Next.js runtime to avoid worker transports.
    const prettyRequested = process.env.LOG_PRETTY === '1';
    const enablePretty = prettyRequested && process.env.NODE_ENV !== 'test' && !inNextRuntime;

    if (enablePretty) {
        const mode = (process.env.LOG_PRETTY_MODE || 'short').toLowerCase(); // 'short' | 'expanded'
        const commonPrettyOpts = {
            colorize: true,
            translateTime: 'SYS:standard' as const,
            ignore: 'pid,hostname',
            errorLikeObjectKeys: ['err', 'error'],
            errorProps: '*',
            messageFormat: '{name} {msg}'
        };
        const options = mode === 'expanded'
            ? { ...commonPrettyOpts, singleLine: false, levelFirst: true }
            : { ...commonPrettyOpts, singleLine: true, levelFirst: true };

        return pino({ level, redact, transport: { target: 'pino-pretty', options } });
    }

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
