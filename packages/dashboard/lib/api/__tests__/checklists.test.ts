import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../core', () => ({ apiRequest: mocks.request }));
import { checklistsApi } from '../checklists';
beforeEach(() => { vi.clearAllMocks(); mocks.request.mockResolvedValue({}); });
describe('checklist API proxy transport', () => {
    it('uses the authenticated external proxy for every owner operation', async () => {
        await checklistsApi.list(); await checklistsApi.create({ title: 'Setup', items: ['Mic'] });
        await checklistsApi.edit('id', { title: 'Setup', items: ['Camera'], version: 0 });
        await checklistsApi.remove('id', 1); await checklistsApi.start('id', { version: 1 });
        expect(mocks.request.mock.calls.map(call => call[0])).toEqual(['/api/external/userChecklistTemplates', '/api/external/userChecklistTemplates',
            '/api/external/userChecklistTemplates/id', '/api/external/userChecklistTemplates/id', '/api/external/userChecklistTemplates/id/start']);
    });
});
