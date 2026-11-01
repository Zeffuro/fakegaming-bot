import { expectOk, expectCreated, expectUnauthorized, expectForbidden, expectBadRequest, expectNotFound, expectConflict } from '@zeffuro/fakegaming-common/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { CACHE_KEYS, CACHE_TTL, defaultCacheManager } from '@zeffuro/fakegaming-common';
import { SubmissionCategory, SubmissionRecord } from '@zeffuro/fakegaming-common/models';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { givenAuthenticatedClient } from './helpers/client.js';

vi.mock('../utils/submissionConfig.js', async importOriginal => {
    const actual = await importOriginal<typeof import('../utils/submissionConfig.js')>();
    return { ...actual, validateSubmissionConfig: vi.fn(), getSubmissionOptions: vi.fn(async () => ({
        roles: [{ id: '4', name: 'Reviewer', managed: false, permissions: '0' }],
        channels: [{ id: '2', name: 'Showcase', type: 0, guild_id: '1', permission_overwrites: [] }],
    })) };
});

import { SubmissionConfigError, validateSubmissionConfig } from '../utils/submissionConfig.js';
const client = givenAuthenticatedClient(app, { discordId: 'testuser' });
const input = { name: 'Screenshots', destinationChannelId: '2', reviewChannelId: '3',
    reviewerRoleIds: ['4'], submitterRoleIds: [], enabled: true };

beforeEach(async () => {
    vi.mocked(validateSubmissionConfig).mockReset();
    await Promise.all([SubmissionCategory.destroy({ where: {} }), SubmissionRecord.destroy({ where: {} })]);
    await defaultCacheManager.set(CACHE_KEYS.userGuilds('testuser'), [{ id: '1', permissions: '8' }], CACHE_TTL.USER_GUILDS);
});

describe('submission category administrator API', () => {
    it('requires auth and guild administrator access for category and Discord options reads', async () => {
        expectUnauthorized(await request(app).get('/api/submissions/1/categories'));
        expectForbidden(await client.get('/api/submissions/9/categories'));
        expectForbidden(await client.get('/api/submissions/9/options'));
        expectForbidden(await client.post('/api/submissions/9/categories').send(input));
        expect(validateSubmissionConfig).not.toHaveBeenCalled();
    });

    it('creates and optimistically edits categories without disclosing private submitted records', async () => {
        const created = await client.post('/api/submissions/1/categories').send(input);
        expectCreated(created);
        expect(created.body).toMatchObject({ ...input, guildId: '1', version: 0 });
        expect(validateSubmissionConfig).toHaveBeenCalledWith('1', input);
        await configManager.submissionManager.create({ guildId: '1', categoryId: created.body.id, userId: '10',
            explanation: 'Private explanation', link: 'https://example.com', credit: null, attachmentCount: 0 });
        const listed = await client.get('/api/submissions/1/categories');
        expectOk(listed);
        expect(listed.headers['cache-control']).toBe('private, no-store');
        expect(JSON.stringify(listed.body)).not.toContain('Private explanation');
        expectNotFound(await client.get('/api/submissions/1/records'));
        const saved = await client.put(`/api/submissions/1/categories/${created.body.id}`).send({ ...input, name: 'Clips', expectedVersion: 0 });
        expectOk(saved);
        expect(saved.body.version).toBe(1);
        const stale = await client.put(`/api/submissions/1/categories/${created.body.id}`).set('Accept-Language', 'nl')
            .send({ ...input, expectedVersion: 0 });
        expectConflict(stale);
        expect(stale.body.error).toMatchObject({ code: 'STALE', message: expect.stringContaining('gewijzigd') });
    });

    it('rejects injected guild/record fields and updates without a version', async () => {
        for (const extra of [{ guildId: '9' }, { status: 'published' }, { reviewerId: '20' }]) {
            expectBadRequest(await client.post('/api/submissions/1/categories').send({ ...input, ...extra }));
        }
        expectBadRequest(await client.put('/api/submissions/1/categories/880ba64a-67ea-4d90-b508-e55ad32c24d2').send(input));
        expectBadRequest(await client.post('/api/submissions/1/categories').send({ ...input, reviewerRoleIds: [] }));
        expectBadRequest(await client.post('/api/submissions/1/categories').send({ ...input, reviewChannelId: '2' }));
    });

    it('rejects unsafe live permissions with actionable localized errors and permits emergency disabling', async () => {
        vi.mocked(validateSubmissionConfig).mockRejectedValue(new SubmissionConfigError('review-access'));
        const rejected = await client.post('/api/submissions/1/categories').set('Accept-Language', 'nl').send(input);
        expectBadRequest(rejected);
        expect(rejected.body.error).toMatchObject({ code: 'REVIEW_ACCESS', message: expect.stringContaining('verbergen') });
        expect(await SubmissionCategory.count()).toBe(0);
        const disabled = await client.post('/api/submissions/1/categories').send({ ...input, enabled: false });
        expectCreated(disabled);
        expect(disabled.body.enabled).toBe(false);
    });

    it('does not expose permission payloads through options', async () => {
        const result = await client.get('/api/submissions/1/options');
        expectOk(result);
        expect(result.body).toEqual({ roles: [{ id: '4', name: 'Reviewer', managed: false }],
            channels: [{ id: '2', name: 'Showcase', type: 0 }] });
    });

    it('enforces CSRF on a fully authenticated mutation without a token', async () => {
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try {
            expectForbidden(await client.post('/api/submissions/1/categories').send(input));
        } finally { vi.unstubAllEnvs(); }
    });
});
