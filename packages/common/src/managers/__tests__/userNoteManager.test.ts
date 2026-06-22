import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';

describe('UserNoteManager', () => {
    const manager = configManager.userNoteManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('creates and lists notes for one user only', async () => {
        const first = await manager.createForUser({
            discordId: 'user-1',
            title: 'First',
            body: 'Body',
            pinned: false,
        });
        const pinned = await manager.createForUser({
            discordId: 'user-1',
            title: 'Pinned',
            body: '',
            pinned: true,
        });
        await manager.createForUser({
            discordId: 'user-2',
            title: 'Other',
            body: 'Hidden',
        });

        const notes = await manager.listForUser('user-1');

        expect(notes).toHaveLength(2);
        expect(notes[0]?.id).toBe(pinned.id);
        expect(notes[1]?.id).toBe(first.id);
    });

    it('updates and removes notes only for the owning user', async () => {
        const created = await manager.createForUser({
            discordId: 'owner',
            title: 'Original',
            body: 'Body',
        });

        await expect(manager.updateForUser(created.id, 'other-user', { title: 'Nope' })).resolves.toBeNull();
        const updated = await manager.updateForUser(created.id, 'owner', { title: 'Updated', pinned: true });

        expect(updated).toMatchObject({
            id: created.id,
            title: 'Updated',
        });
        expect(Boolean(updated?.pinned)).toBe(true);
        await expect(manager.removeForUser(created.id, 'other-user')).resolves.toBe(false);
        await expect(manager.removeForUser(created.id, 'owner')).resolves.toBe(true);
        await expect(manager.getForUser(created.id, 'owner')).resolves.toBeNull();
    });

    it('derives titles from note bodies when titles are omitted', async () => {
        const created = await manager.createForUser({
            discordId: 'owner',
            body: '  First line of the note  \nSecond line',
        });

        expect(created.title).toBe('First line of the note');

        const retitled = await manager.updateForUser(created.id, 'owner', {
            title: '',
            body: 'Replacement body title',
        });

        expect(retitled?.title).toBe('Replacement body title');
    });
});
