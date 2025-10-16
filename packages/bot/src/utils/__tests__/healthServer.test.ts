import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import type { Client } from 'discord.js';
import { startHealthServer } from '../healthServer.js';
import { expectOk, expectServiceUnavailable } from '@zeffuro/fakegaming-common/testing';

function httpGet(url: string): Promise<{ status: number; body: string; json?: unknown }> {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                resolve({ status: res.statusCode ?? 0, body, json: safeJson(body) });
            });
        });
        req.on('error', reject);
    });
}

function safeJson(s: string): unknown {
    try { return JSON.parse(s); } catch { return undefined; }
}

describe('bot health server', () => {
    let server: http.Server | null = null;
    let port = 0;
    let originalProvider: string | undefined;

    beforeEach(() => {
        originalProvider = process.env.DATABASE_PROVIDER;
        delete process.env.DATABASE_PROVIDER; // ensure DB check is skipped by default
    });

    afterEach(async () => {
        process.env.DATABASE_PROVIDER = originalProvider;
        if (server) {
            await new Promise<void>((resolve) => server!.close(() => resolve()));
            server = null;
            port = 0;
        }
    });

    it('returns 200 on /healthz', async () => {
        const client = { isReady: () => false } as unknown as Client;
        const started = await startHealthServer({ client, port: 0 });
        expect(started.server).not.toBeNull();
        server = started.server as http.Server;
        port = started.port;

        const res = await httpGet(`http://127.0.0.1:${port}/healthz`);
        expectOk(res);
        expect(res.json).toMatchObject({ status: 'ok' });
    });

    it('returns 503 on /ready when client not ready; 200 when ready', async () => {
        const notReadyClient = { isReady: () => false } as unknown as Client;
        const started1 = await startHealthServer({ client: notReadyClient, port: 0 });
        server = started1.server as http.Server;
        port = started1.port;

        const res1 = await httpGet(`http://127.0.0.1:${port}/ready`);
        expectServiceUnavailable(res1);

        await new Promise<void>((resolve) => server!.close(() => resolve()));
        server = null;

        const readyClient = { isReady: () => true } as unknown as Client;
        const started2 = await startHealthServer({ client: readyClient, port: 0 });
        server = started2.server as http.Server;
        port = started2.port;

        const res2 = await httpGet(`http://127.0.0.1:${port}/ready`);
        expectOk(res2);
        expect(res2.json).toMatchObject({ status: 'ok' });
    });
});
