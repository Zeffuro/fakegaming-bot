import http from 'node:http';
import type { Client } from 'discord.js';
import { getLogger, getSequelize } from '@zeffuro/fakegaming-common';

export interface HealthServerOptions {
    client: Client;
    port?: number;
    host?: string;
    logger?: ReturnType<typeof getLogger>;
}

interface HealthStatusBody {
    status: 'ok' | 'error';
    details?: Record<string, unknown>;
}

function isClientReady(client: Client): boolean {
    try {
        const maybeIsReady = (client as unknown as { isReady?: () => boolean }).isReady;
        if (typeof maybeIsReady === 'function') return Boolean(maybeIsReady());
    } catch {
        // ignore and fall back
    }
    // Fallback: presence of a logged-in user typically indicates readiness
    return Boolean((client as Client).user);
}

async function checkDbReady(): Promise<{ ok: boolean; error?: unknown; skipped?: boolean }> {
    const provider = process.env.DATABASE_PROVIDER;
    if (!provider) return { ok: true, skipped: true };
    try {
        const sequelize = getSequelize();
        await sequelize.authenticate();
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err };
    }
}

/**
 * Start a tiny HTTP server exposing /healthz and /ready for the bot process.
 * - /healthz: returns 200 when process is up.
 * - /ready: returns 200 when the Discord client is ready and DB (if configured) is reachable; else 503.
 */
export async function startHealthServer(opts: HealthServerOptions): Promise<{ server: http.Server; port: number } | { server: null; port: 0 }> {
    const logger = opts.logger ?? getLogger({ name: 'bot.health' });

    const port = typeof opts.port === 'number' && opts.port >= 0 ? opts.port : 0;
    const host = opts.host ?? '127.0.0.1';

    const server = http.createServer(async (req, res) => {
        try {
            if (!req.url) {
                res.statusCode = 400;
                res.end('Bad Request');
                return;
            }
            if (req.method !== 'GET') {
                res.statusCode = 405;
                res.setHeader('Allow', 'GET');
                res.end('Method Not Allowed');
                return;
            }

            if (req.url.startsWith('/healthz')) {
                const body: HealthStatusBody = { status: 'ok' };
                const payload = JSON.stringify(body);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store');
                res.end(payload);
                return;
            }

            if (req.url.startsWith('/ready')) {
                const clientOk = isClientReady(opts.client);
                const db = await checkDbReady();
                const ok = clientOk && db.ok;
                const body: HealthStatusBody = ok
                    ? { status: 'ok', details: { client: 'ready', db: db.skipped ? 'skipped' : 'ok' } }
                    : { status: 'error', details: { client: clientOk ? 'ready' : 'not_ready', db: db.skipped ? 'skipped' : 'error' } };
                const payload = JSON.stringify(body);
                res.statusCode = ok ? 200 : 503;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store');
                res.end(payload);
                return;
            }

            res.statusCode = 404;
            res.end('Not Found');
        } catch (err) {
            logger.error({ err }, 'Unhandled error in health server');
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    return await new Promise((resolve) => {
        server.listen(port, host, () => {
            const address = server.address();
            const boundPort = typeof address === 'object' && address && 'port' in address ? address.port as number : 0;
            logger.info({ host, port: boundPort }, 'Bot health server started');
            resolve({ server, port: boundPort });
        });
        server.on('error', (err) => {
            logger.error({ err }, 'Failed to start bot health server');
            resolve({ server: null, port: 0 });
        });
    });
}

export { }
