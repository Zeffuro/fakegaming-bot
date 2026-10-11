import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../core', () => ({ apiRequest: mocks.request }));
import { pollTemplatesApi } from '../pollTemplates';
beforeEach(() => { vi.clearAllMocks(); mocks.request.mockResolvedValue({}); });
describe('private saved poll proxy transport', () => {
    it('uses the authenticated external proxy and carries owner versions without selectors', async () => {
        const input = { title: 'Dinner', question: 'Food?', options: ['A', 'B'], durationMinutes: 10, allowMultiple: false, hideResults: false, ranked: true };
        await pollTemplatesApi.list(); await pollTemplatesApi.create(input); await pollTemplatesApi.edit('id/a', { ...input, version: 3 });
        await pollTemplatesApi.remove('id/a', 4);
        expect(mocks.request.mock.calls.map(call => call[0])).toEqual(['/api/external/pollTemplates', '/api/external/pollTemplates', '/api/external/pollTemplates/id%2Fa', '/api/external/pollTemplates/id%2Fa']);
        expect(mocks.request).toHaveBeenLastCalledWith('/api/external/pollTemplates/id%2Fa', { method: 'DELETE', body: { version: 4 } });
        expect(mocks.request).toHaveBeenNthCalledWith(2, '/api/external/pollTemplates', { method: 'POST', body: input });
    });
});
