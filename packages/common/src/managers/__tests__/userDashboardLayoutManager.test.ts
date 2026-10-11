import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDashboardLayout } from '../../models/user-dashboard-layout.js';
import { defaultDashboardSections, mergeDashboardSections, validDashboardLayout } from '../../utils/dashboardLayout.js';
import { UserDashboardLayoutManager } from '../userDashboardLayoutManager.js';

describe('personal dashboard layout persistence', () => {
    const manager = new UserDashboardLayoutManager();
    const input = () => ({ schemaVersion: 1 as const, version: 0, sections: defaultDashboardSections() });
    beforeEach(async () => { await UserDashboardLayout.destroy({ where: {} }); });
    it('adds notification history without changing a saved legacy panel order or visibility', async () => {
        const legacy = defaultDashboardSections().filter(section => section.id !== 'notificationHistory').reverse();
        legacy[0]!.visible = false;
        await UserDashboardLayout.create({ userId: 'legacy-layout', version: 7, schemaVersion: 1, sectionsJson: JSON.stringify(legacy) });
        const upgraded = await manager.get('legacy-layout');
        expect(upgraded.version).toBe(7); expect(upgraded.sections.slice(0, legacy.length)).toEqual(legacy);
        expect(upgraded.sections.at(-1)).toEqual({ id: 'notificationHistory', visible: true });
    });
    it('uses focused priority defaults without creating a row and persists per account', async () => {
        expect(await manager.get('owner')).toEqual(input()); expect(await UserDashboardLayout.count()).toBe(0);
        expect((await manager.get('owner')).sections.slice(0, 4).map(section => section.id)).toEqual(['today', 'subscriptions', 'tasks', 'notes']);
        const value = input(); value.sections.reverse(); value.sections[0].visible = false;
        expect(await manager.save('owner', value)).toEqual({ ...value, version: 1 });
        expect(await new UserDashboardLayoutManager().get('owner')).toEqual({ ...value, version: 1 });
        expect(await manager.get('other')).toEqual(input());
        await manager.save('other', input()); expect(await manager.get('owner')).toEqual({ ...value, version: 1 });
    });
    it('serializes initial and subsequent writes and rejects stale reset without losing data', async () => {
        const results = await Promise.allSettled([manager.save('owner', input()), manager.save('owner', input())]);
        expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(value => value.status === 'rejected')).toHaveLength(1);
        const changed = { ...input(), version: 1 }; changed.sections[0].visible = false;
        await manager.save('owner', changed);
        await expect(manager.reset('owner', 1)).rejects.toThrow('stale');
        expect((await manager.get('owner')).sections[0].visible).toBe(false);
        expect(await manager.reset('owner', 2)).toEqual({ ...input(), version: 3 });
    });
    it('merges removed, duplicate and new sections deterministically on read', async () => {
        await UserDashboardLayout.create({ userId: 'owner', version: 7, schemaVersion: 1,
            sectionsJson: JSON.stringify([{ id: 'tasks', visible: false }, { id: 'obsolete', visible: false }, { id: 'tasks', visible: true }]) });
        const merged = await manager.get('owner'); expect(merged.version).toBe(7);
        expect(merged.sections[0]).toEqual({ id: 'tasks', visible: false });
        expect(merged.sections).toHaveLength(defaultDashboardSections().length);
        expect(merged.sections.slice(1).every(value => value.visible)).toBe(true);
        expect(mergeDashboardSections(null)).toEqual(defaultDashboardSections());
        await UserDashboardLayout.update({ sectionsJson: 'bad json' }, { where: { userId: 'owner' } });
        expect((await manager.get('owner')).sections).toEqual(defaultDashboardSections());
    });
    it('rejects invalid schema, IDs, duplicate sections, visibility and versions before writing', async () => {
        const value = input();
        for (const invalid of [null, { ...value, schemaVersion: 2 }, { ...value, version: -1 }, { ...value, version: 1.5 },
            { ...value, sections: value.sections.slice(1) }, { ...value, sections: [...value.sections.slice(1), value.sections[1]] },
            { ...value, sections: [{ id: 'unsupported', visible: true }, ...value.sections.slice(1)] },
            { ...value, sections: [{ id: 'today', visible: 'yes' }, ...value.sections.slice(1)] },
            { ...value, sections: [{ id: 'today', visible: true, extra: true }, ...value.sections.slice(1)] }, { ...value, userId: 'other' }]) {
            expect(validDashboardLayout(invalid)).toBe(false);
            await expect(manager.save('owner', invalid as typeof value)).rejects.toThrow('invalid');
        }
        await expect(manager.save('', value)).rejects.toThrow('invalid');
        expect(await UserDashboardLayout.count()).toBe(0);
    });
    it('rolls back failed persistence and cannot overwrite an exhausted version', async () => {
        const spy = vi.spyOn(UserDashboardLayout, 'create').mockRejectedValueOnce(new Error('storage failed'));
        await expect(manager.save('owner', input())).rejects.toThrow('storage failed'); spy.mockRestore();
        expect(await manager.get('owner')).toEqual(input());
        await UserDashboardLayout.create({ userId: 'owner', version: 2147483647, schemaVersion: 1, sectionsJson: '[]' });
        await expect(manager.save('owner', { ...input(), version: 2147483647 })).rejects.toThrow('stale');
    });
});
