import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserTask } from '../../models/personal-productivity.js';
import { UserConfig } from '../../models/user-config.js';
import { ReminderConfig } from '../../models/reminder-config.js';
import { UserTaskManager } from '../userTaskManager.js';
import { UserChecklistTemplate } from '../../models/user-checklist-template.js';
import { UserChecklistTemplateManager } from '../userChecklistTemplateManager.js';

const manager = new UserChecklistTemplateManager();
beforeEach(async () => { await UserChecklistTemplate.destroy({ where: {} }); await UserTask.destroy({ where: {} }); await ReminderConfig.destroy({ where: {} }); await UserConfig.destroy({ where: {} }); });
describe('reusable checklist templates', () => {
    it('persists trimmed independent unchecked item text and protects ownership', async () => {
        const saved = await manager.create('owner', ' Packing ', [' Passport ', 'Charger']);
        expect(saved).toMatchObject({ title: 'Packing', items: ['Passport', 'Charger'], version: 0 });
        expect(await new UserChecklistTemplateManager().list('owner')).toEqual([saved]);
        expect(await manager.list('other')).toEqual([]);
        expect(await manager.get(saved.id, 'other')).toBeNull();
        await expect(manager.edit(saved.id, 'other', 0, 'Stolen', ['A'])).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.remove(saved.id, 'other', 0)).rejects.toMatchObject({ code: 'missing' });
    });
    it('serializes competing version edits and rejects stale deletion', async () => {
        const saved = await manager.create('owner', 'Original', ['One']);
        const attempts = await Promise.allSettled(['First', 'Second'].map(title => manager.edit(saved.id, 'owner', 0, title, ['Changed'])));
        expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
        expect(attempts.filter(item => item.status === 'rejected')).toHaveLength(1);
        expect(await manager.get(saved.id, 'owner')).toMatchObject({ version: 1, items: ['Changed'] });
        await expect(manager.remove(saved.id, 'owner', 0)).rejects.toMatchObject({ code: 'stale' });
        await manager.remove(saved.id, 'owner', 1);
        expect(await manager.get(saved.id, 'owner')).toBeNull();
    });
    it.each([{ title: '', items: ['A'] }, { title: 'x'.repeat(121), items: ['A'] }, { title: 'A', items: [] },
        { title: 'A', items: Array(11).fill('A') as string[] }, { title: 'A', items: [' '] }, { title: 'A', items: ['x'.repeat(121)] }])('rejects invalid content atomically %j', async input => {
        await expect(manager.create('owner', input.title, input.items)).rejects.toMatchObject({ code: 'invalid' });
        expect(await UserChecklistTemplate.count()).toBe(0);
    });
    it('bounds stored lists per owner without limiting another owner', async () => {
        await UserChecklistTemplate.bulkCreate(Array.from({ length: 50 }, (_, index) => ({ id: `list-${index}`, userId: 'owner', title: 'List', itemsJson: '["One"]', version: 0 })));
        await expect(manager.create('owner', 'Extra', ['One'])).rejects.toMatchObject({ code: 'capacity' });
        expect(await manager.create('other', 'Own', ['One'])).toMatchObject({ title: 'Own' });
    });
    it('starts independent copies in the same transaction and rolls back failed reminder creation', async () => {
        const now = Date.parse('2026-10-09T12:00:00Z');
        const lists = new UserChecklistTemplateManager(() => now); const tasks = new UserTaskManager(() => now);
        const list = await lists.create('owner', 'Packing', ['Passport']);
        await UserConfig.update({ timezone: 'Europe/Amsterdam' }, { where: { discordId: 'owner' } });
        const create = vi.spyOn(tasks, 'create');
        const first = await lists.start(list.id, 'owner', 0, tasks);
        expect(create.mock.calls[0]?.[1]).toBeDefined();
        expect(first.checklist).toEqual([{ text: 'Passport', done: false }]);
        await tasks.check(first.id, 'owner', 0, 0);
        const second = await lists.start(list.id, 'owner', 0, tasks);
        expect(second.id).not.toBe(first.id); expect(second.checklist[0]?.done).toBe(false);
        const reminder = vi.spyOn(ReminderConfig, 'create').mockRejectedValueOnce(new Error('Reminder storage failed'));
        try { await expect(lists.start(list.id, 'owner', 0, tasks, { due: '2026-10-10T09:00', exact: true })).rejects.toThrow('Reminder storage failed'); }
        finally { reminder.mockRestore(); }
        expect(await UserTask.count()).toBe(2); expect(await ReminderConfig.count()).toBe(0);
    });
    it('rechecks the source version and timezone after entering the transaction', async () => {
        const list = await manager.create('owner', 'Original', ['One']);
        const tasks = new UserTaskManager();
        const originalFind = UserChecklistTemplate.findOne.bind(UserChecklistTemplate);
        const lookup = vi.spyOn(UserChecklistTemplate, 'findOne').mockImplementationOnce(async options => {
            expect(options?.lock).toBeDefined();
            await UserChecklistTemplate.update({ version: 1 }, { where: { id: list.id }, transaction: options?.transaction });
            return originalFind(options);
        });
        try { await expect(manager.start(list.id, 'owner', 0, tasks)).rejects.toMatchObject({ code: 'stale' }); }
        finally { lookup.mockRestore(); }
        const findSettings = UserConfig.findByPk.bind(UserConfig);
        const preferences = vi.spyOn(UserConfig, 'findByPk').mockImplementationOnce(async (id, options) => {
            expect(options?.lock).toBeDefined();
            await UserConfig.update({ timezone: 'Europe/Amsterdam' }, { where: { discordId: id as string }, transaction: options?.transaction });
            return findSettings(id, options);
        });
        try { await expect(manager.start(list.id, 'owner', 0, tasks, { timezone: 'UTC' })).rejects.toMatchObject({ code: 'stale' }); }
        finally { preferences.mockRestore(); }
        expect(await UserTask.count()).toBe(0);
    });
});
