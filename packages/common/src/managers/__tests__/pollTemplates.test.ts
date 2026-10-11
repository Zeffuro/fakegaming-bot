import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollTemplate } from '../../models/poll-template.js';
import { PollSession } from '../../models/poll-session.js';
import { UserConfig } from '../../models/user-config.js';
import { PollTemplateManager } from '../pollTemplateManager.js';
import { PollManager } from '../pollManager.js';

const manager = new PollTemplateManager();
const input = { title: 'Dinner', question: 'Which food?', options: ['Pizza', 'Pasta'], durationMinutes: 30 };
const scope = { guildId: 'guild', channelId: 'channel', messageId: 'message' };
beforeEach(async () => { await PollTemplate.destroy({ where: {} }); await PollSession.destroy({ where: {} }); await UserConfig.destroy({ where: {} }); });
describe('private reusable poll templates', () => {
    it('keeps settings private with safe defaults and enforces owner boundaries', async () => {
        const saved = await manager.create('owner', input);
        expect(saved).toMatchObject({ ...input, version: 0, allowMultiple: false, hideResults: false });
        expect(await new PollTemplateManager().list('owner')).toEqual([saved]);
        expect(await manager.list('other')).toEqual([]); expect(await manager.get(saved.id, 'other')).toBeNull();
        await expect(manager.edit(saved.id, 'other', 0, input)).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.remove(saved.id, 'other', 0)).rejects.toMatchObject({ code: 'missing' });
        await expect(manager.start(saved.id, 'other', 0, new PollManager(), scope)).rejects.toMatchObject({ code: 'missing' });
    });
    it('copies only creator-owned poll settings, excluding voters and bindings', async () => {
        const polls = new PollManager();
        const original = await polls.create({ ...scope, creatorId: 'owner', ...input, allowMultiple: true, hideResults: true });
        await polls.vote(original.id, scope, 'private-voter', 0);
        await expect(manager.savePoll('other', original.id, 'Copy')).rejects.toMatchObject({ code: 'missing' });
        const saved = await manager.savePoll('owner', scope.messageId, 'Copy');
        expect(saved).toMatchObject({ title: 'Copy', question: input.question, options: input.options, durationMinutes: 30, allowMultiple: true, hideResults: true });
        const persisted = (await PollTemplate.findByPk(saved.id))!.toJSON();
        expect(JSON.stringify(persisted)).not.toContain('private-voter');
        for (const key of ['votesJson', 'creatorId', 'guildId', 'channelId', 'messageId', 'expiresAt', 'closedAt']) expect(persisted).not.toHaveProperty(key);
    });
    it('preserves exact stored duration with injected clocks and handles legacy persisted polls', async () => {
        const polls = new PollManager({ now: () => Date.parse('2020-01-01T00:00:00Z') });
        const original = await polls.create({ ...scope, creatorId: 'owner', ...input, durationMinutes: 1440 });
        expect((await manager.savePoll('owner', original.id, 'Exact')).durationMinutes).toBe(1440);
        await PollSession.update({ durationMinutes: null, expiresAt: Date.parse('2020-01-01T00:07:00Z'),
            createdAt: new Date('2020-01-01T00:00:00Z') }, { where: { id: original.id }, silent: true });
        expect((await manager.savePoll('owner', original.id, 'Legacy')).durationMinutes).toBe(7);
    });
    it('rolls back failed fresh poll creation and rejects removed templates', async () => {
        const saved = await manager.create('owner', input); const polls = new PollManager();
        const create = vi.spyOn(PollSession, 'create').mockRejectedValueOnce(new Error('Database unavailable'));
        try { await expect(manager.start(saved.id, 'owner', 0, polls, scope)).rejects.toThrow('Database unavailable'); }
        finally { create.mockRestore(); }
        expect(await PollSession.count()).toBe(0); expect(await manager.get(saved.id, 'owner')).toEqual(saved);
        await manager.remove(saved.id, 'owner', 0);
        await expect(manager.start(saved.id, 'owner', 0, polls, scope)).rejects.toMatchObject({ code: 'missing' });
    });
    it('creates independent fresh polls and retains votes after editing or deleting their template', async () => {
        let now = Date.now(); const polls = new PollManager({ now: () => now });
        const saved = await manager.create('owner', { ...input, allowMultiple: true, hideResults: true });
        const first = await manager.start(saved.id, 'owner', 0, polls, scope);
        await polls.vote(first.id, scope, 'voter', 0);
        now += 60_000;
        const secondScope = { ...scope, messageId: 'second' };
        const second = await manager.start(saved.id, 'owner', 0, polls, secondScope);
        expect(second.id).not.toBe(first.id); expect(second.votes.size).toBe(0);
        expect(second.expiresAt).toBe(now + 30 * 60_000); expect(second.hideResults).toBe(true);
        second.options[0] = 'Changed locally';
        expect((await manager.get(saved.id, 'owner'))?.options[0]).toBe('Pizza');
        await manager.edit(saved.id, 'owner', 0, { ...input, question: 'New question?' });
        await manager.remove(saved.id, 'owner', 1);
        expect((await polls.get(first.id, scope))?.votes.get('voter')).toEqual([0]);
        expect((await polls.get(first.id, scope))?.question).toBe(input.question);
        expect((await polls.get(second.id, secondScope))?.options).toEqual(input.options);
        await expect(polls.vote(first.id, secondScope, 'voter', 1)).rejects.toMatchObject({ code: 'missing' });
        now += 30 * 60_000;
        expect((await polls.get(second.id, secondScope))?.closeReason).toBe('expired');
        expect((await new PollManager({ now: () => now }).listForRecovery()).map(poll => poll.id)).toContain(second.id);
    });
    it('rejects stale source versions under lock and preserves capacity on failure', async () => {
        const saved = await manager.create('owner', input); const polls = new PollManager({ maxActive: 0 });
        const find = PollTemplate.findOne.bind(PollTemplate);
        const lookup = vi.spyOn(PollTemplate, 'findOne').mockImplementationOnce(async options => {
            expect(options?.lock).toBeDefined();
            await PollTemplate.update({ version: 1 }, { where: { id: saved.id }, transaction: options?.transaction });
            return find(options);
        });
        try { await expect(manager.start(saved.id, 'owner', 0, polls, scope)).rejects.toMatchObject({ code: 'stale' }); }
        finally { lookup.mockRestore(); }
        await expect(manager.start(saved.id, 'owner', 0, polls, scope)).rejects.toMatchObject({ code: 'capacity' });
        expect(await PollSession.count()).toBe(0); expect(await manager.get(saved.id, 'owner')).toEqual(saved);
        await manager.edit(saved.id, 'owner', 0, input);
        await expect(manager.remove(saved.id, 'owner', 0)).rejects.toMatchObject({ code: 'stale' });
        await expect(manager.edit(saved.id, 'owner', 0, input)).rejects.toMatchObject({ code: 'stale' });
    });
    it.each([{ ...input, options: ['A', 'ａ'] }, { ...input, options: ['A'] }, { ...input, options: Array(6).fill('A') as string[] },
        { ...input, question: ' ' }, { ...input, question: 'x'.repeat(201) }, { ...input, title: 'x'.repeat(121) },
        { ...input, options: ['A', 'x'.repeat(201)] }, { ...input, durationMinutes: 0 }, { ...input, durationMinutes: 1441 },
        { ...input, durationMinutes: 1.5 }])('rejects invalid settings %j', async invalid => {
        await expect(manager.create('owner', invalid)).rejects.toMatchObject({ code: 'invalid' }); expect(await PollTemplate.count()).toBe(0);
    });
    it('bounds templates per owner across manager instances', async () => {
        await PollTemplate.bulkCreate(Array.from({ length: 49 }, (_, i) => ({ id: `template-${i}`, userId: 'owner', ...input, optionsJson: JSON.stringify(input.options), version: 0 })));
        const attempts = await Promise.allSettled([manager, new PollTemplateManager()].map(value => value.create('owner', input)));
        expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(attempts.filter(result => result.status === 'rejected')).toHaveLength(1);
        expect(await PollTemplate.count({ where: { userId: 'owner' } })).toBe(50);
        expect(await manager.create('other', input)).toMatchObject({ title: input.title });
    });
});
