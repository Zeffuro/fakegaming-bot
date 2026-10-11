import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserTask } from '../../models/personal-productivity.js';
import { UserNoteConfig } from '../../models/user-note-config.js';
import { ReminderConfig } from '../../models/reminder-config.js';
import { UserTaskManager } from '../userTaskManager.js';
import { UserNoteManager } from '../userNoteManager.js';

let now = Date.parse('2026-10-23T08:00:00Z');
const notes = new UserNoteManager();
const sourceUrl = 'https://discord.com/channels/123/456/789';
const input = { userId: 'owner', title: 'Send configuration', timezone: 'Europe/Amsterdam', due: '2026-10-23 12:30' };

beforeEach(async () => {
    now = Date.parse('2026-10-23T08:00:00Z');
    await ReminderConfig.destroy({ where: {} });
    await UserTask.destroy({ where: {} });
    await UserNoteConfig.destroy({ where: {} });
});

async function save() {
    return notes.createForUser({ discordId: 'owner', title: 'Saved request', body: 'Private original text', sourceUrl, tags: ['work'] });
}

describe('linked note tasks', () => {
    it('creates one owner-bound task and snapshots its source without changing the note', async () => {
        const note = await save();
        const manager = new UserTaskManager(() => now);
        const result = await manager.fromNote({ ...input, noteId: note.id });
        expect(result).toMatchObject({ created: true, task: { title: input.title, sourceNoteId: note.id, sourceUrl,
            dueAt: Date.parse('2026-10-23T10:30:00Z'), timezone: input.timezone, state: 'active' } });
        expect(await notes.getForUser(note.id, 'owner')).toMatchObject({ title: note.title, body: note.body, sourceUrl, status: 'unread', tags: ['work'], linkedTaskId: result.task.id });
        expect(await ReminderConfig.count()).toBe(1);
        expect(await new UserTaskManager(() => now).get(result.task.id, 'owner')).toEqual(result.task);
        expect(await manager.get(result.task.id, 'other')).toBeNull();
        await notes.removeForUser(note.id, 'owner');
        expect(await manager.get(result.task.id, 'owner')).toMatchObject({ sourceNoteId: note.id, sourceUrl });
    });

    it('deduplicates concurrent attempts and delayed retries after restart without editing the task', async () => {
        const note = await save();
        const results = await Promise.all(Array.from({ length: 4 }, () => new UserTaskManager(() => now).fromNote({ ...input, noteId: note.id })));
        expect(results.filter(result => result.created)).toHaveLength(1);
        expect(new Set(results.map(result => result.task.id)).size).toBe(1);
        expect(await UserTask.count()).toBe(1);
        expect(await ReminderConfig.count()).toBe(1);
        now += 86_400_000;
        const retry = await new UserTaskManager(() => now).fromNote({ ...input, title: 'Replacement', noteId: note.id });
        expect(retry).toMatchObject({ created: false, task: { title: input.title, dueAt: results[0]!.task.dueAt } });
    });

    it('returns completed tasks and never recreates a deleted linked task', async () => {
        const note = await save();
        const manager = new UserTaskManager(() => now);
        const { task } = await manager.fromNote({ ...input, noteId: note.id });
        await manager.done(task.id, 'owner', task.version);
        expect(await manager.fromNote({ ...input, noteId: note.id })).toMatchObject({ created: false, task: { id: task.id, state: 'completed' } });
        await manager.remove(task.id, 'owner');
        await expect(manager.fromNote({ ...input, noteId: note.id })).rejects.toMatchObject({ code: 'stale' });
        expect(await UserTask.count()).toBe(0);
        expect((await notes.getForUser(note.id, 'owner'))?.linkedTaskId).toBe(task.id);
    });

    it('preserves the binding after retention expiry and source edits', async () => {
        const note = await save();
        const manager = new UserTaskManager(() => now);
        const { task } = await manager.fromNote({ ...input, noteId: note.id });
        await notes.updateForUser(note.id, 'owner', { sourceUrl: 'https://example.com/changed' });
        expect((await manager.fromNote({ ...input, noteId: note.id })).task.sourceUrl).toBe(sourceUrl);
        await manager.done(task.id, 'owner', task.version);
        now += 91 * 86_400_000;
        await manager.list('owner', true);
        await expect(manager.fromNote({ ...input, noteId: note.id })).rejects.toMatchObject({ code: 'stale' });
    });

    it('denies conversion and retries across owners, including known linked task IDs', async () => {
        const note = await save();
        const manager = new UserTaskManager(() => now);
        await expect(manager.fromNote({ ...input, userId: 'other', noteId: note.id })).rejects.toMatchObject({ code: 'missing' });
        await manager.fromNote({ ...input, noteId: note.id });
        await expect(manager.fromNote({ ...input, userId: 'other', noteId: note.id })).rejects.toMatchObject({ code: 'missing' });
        expect(await UserTask.count()).toBe(1);
    });

    it.each([{ title: '' }, { title: 'x'.repeat(121) }, { due: '1h' }, { due: '2026-02-30 12:00' },
        { due: '2026-10-22 12:00' }, { timezone: 'wrong' }])('rejects invalid creation atomically: %j', async change => {
        const note = await save();
        await expect(new UserTaskManager(() => now).fromNote({ ...input, ...change, noteId: note.id })).rejects.toMatchObject({ code: 'invalid' });
        expect(await UserTask.count()).toBe(0);
        expect((await notes.getForUser(note.id, 'owner'))?.linkedTaskId).toBeNull();
    });

    it('allows undated tasks and omits unsafe legacy source URLs', async () => {
        const note = await save();
        await UserNoteConfig.update({ sourceUrl: 'javascript:alert(1)' }, { where: { id: note.id } });
        const result = await new UserTaskManager(() => now).fromNote({ ...input, due: '', noteId: note.id });
        expect(result.task).toMatchObject({ dueAt: null, sourceUrl: null });
        expect(await ReminderConfig.count()).toBe(0);
    });

    it('rolls back task and reminder creation if saving the note binding fails', async () => {
        const note = await save();
        const update = vi.spyOn(UserNoteConfig.prototype, 'update').mockRejectedValueOnce(new Error('save failed'));
        try {
            await expect(new UserTaskManager(() => now).fromNote({ ...input, noteId: note.id })).rejects.toThrow('save failed');
            expect(await UserTask.count()).toBe(0);
            expect(await ReminderConfig.count()).toBe(0);
            expect((await notes.getForUser(note.id, 'owner'))?.linkedTaskId).toBeNull();
        } finally { update.mockRestore(); }
    });

    it('enforces the active capacity before creating or binding another task', async () => {
        const note = await save();
        const count = vi.spyOn(UserTask, 'count').mockResolvedValueOnce(100);
        try {
            await expect(new UserTaskManager(() => now).fromNote({ ...input, noteId: note.id })).rejects.toMatchObject({ code: 'capacity' });
            expect((await notes.getForUser(note.id, 'owner'))?.linkedTaskId).toBeNull();
            expect(await ReminderConfig.count()).toBe(0);
        } finally { count.mockRestore(); }
        expect(await UserTask.count()).toBe(0);
    });
});
