import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);

describe('compressed JSON request safety', () => {
    it('consumes bytes after a completed compressed frame and stays available', async () => {
        const fixture = fileURLToPath(new URL('./fixtures/compressed-body.mjs', import.meta.url));
        const result = await run(process.execPath, [fixture], { timeout: 5000 });
        expect(result.stdout.trim()).toBe('compressed-body-survived');
        expect(result.stderr).toBe('');
    });
});
