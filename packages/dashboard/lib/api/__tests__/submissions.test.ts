import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../core', () => ({ apiRequest: mocks.request }));
import { submissionsApi } from '../submissions';

beforeEach(() => { vi.clearAllMocks(); mocks.request.mockResolvedValue({}); });

describe('submission configuration transport', () => {
    it('uses the authenticated proxy and carries guild, category and expected version', async () => {
        const input = { name: 'Art', destinationChannelId: '10', reviewChannelId: '20', reviewerRoleIds: ['30'], submitterRoleIds: [], enabled: true };
        await submissionsApi.list('guild/a');
        await submissionsApi.options('guild/a');
        await submissionsApi.create('guild/a', input);
        await submissionsApi.update('guild/a', 'category/b', input, 3);
        expect(mocks.request.mock.calls.map(call => call[0])).toEqual([
            '/api/external/submissions/guild%2Fa/categories', '/api/external/submissions/guild%2Fa/options',
            '/api/external/submissions/guild%2Fa/categories', '/api/external/submissions/guild%2Fa/categories/category%2Fb',
        ]);
        expect(mocks.request).toHaveBeenLastCalledWith('/api/external/submissions/guild%2Fa/categories/category%2Fb', {
            method: 'PUT', body: { ...input, expectedVersion: 3 },
        });
    });
});
