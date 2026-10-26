import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';
import express from 'express';

const app = express();
const decoded = { safe: true };
const body = Buffer.concat([
    gzipSync(JSON.stringify(decoded)), Buffer.from([0]), Buffer.alloc(100 * 1024, 0x58)
]);
let client;

app.use(express.json());
app.post('/', (req, res) => res.json(req.body));
app.get('/health', (_req, res) => res.json({ ok: true }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;

try {
    const result = await new Promise((resolve, reject) => {
        client = http.request({
            host: '127.0.0.1', port, path: '/', method: 'POST', agent: false,
            headers: {
                'Content-Type': 'application/json',
                'Content-Encoding': 'gzip',
                'Content-Length': body.length
            }
        }, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('error', reject);
            response.on('end', () => resolve({ status: response.statusCode, body }));
        });
        client.on('error', reject);
        client.setTimeout(3000, () => client.destroy(new Error('Compressed request stalled')));
        client.end(body);
    });
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), decoded);
    // Late decoder errors can arrive after the response has completed.
    await setTimeout(200);
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    console.log('compressed-body-survived');
} finally {
    client?.destroy();
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
