import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { UserNoteManager } from '../userNoteManager.js';

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

    it('localizes the fallback title while retaining English by default', async () => {
        const english = await manager.createForUser({
            discordId: 'english-owner',
            title: '',
            body: '',
        });
        const dutch = await manager.createForUser({
            discordId: 'dutch-owner',
            title: '',
            body: '',
            locale: 'nl',
        });

        expect(english.title).toBe('Untitled note');
        expect(dutch.title).toBe('Naamloze notitie');
    });

    it('persists inbox metadata across manager recreation and enforces ownership', async () => {
        const created = await manager.createForUser({ discordId: 'owner', body: 'Saved link', tags: [' Games ', 'games', 'CO-OP'], sourceUrl: 'https://example.com/game' });
        expect(created).toMatchObject({ status: 'unread', tags: ['games', 'co-op'], sourceUrl: 'https://example.com/game' });
        const restarted = new UserNoteManager();
        expect(await restarted.getForUser(created.id, 'owner')).toMatchObject({ status: 'unread', tags: ['games', 'co-op'] });
        expect(await restarted.updateForUser(created.id, 'other', { status: 'archived' })).toBeNull();
        expect(await restarted.updateForUser(created.id, 'owner', { status: 'read' })).toMatchObject({ status: 'read' });
        expect(await restarted.updateForUser(created.id, 'owner', { status: 'archived', tags: [] })).toMatchObject({ status: 'archived', tags: [] });
        expect((await restarted.inboxForUser('owner')).notes).toHaveLength(0);
        expect((await restarted.inboxForUser('owner', { status: 'archived' })).notes).toHaveLength(1);
        expect((await restarted.inboxForUser('other', { status: 'all' })).notes).toHaveLength(0);
    });

    it('searches literal text and tags with stable paging', async () => {
        for (let index = 0; index < 7; index++) {
            await manager.createForUser({ discordId: 'owner', title: `Guide ${index}`, body: '100% raid_coop', tags: ['raid'], pinned: index === 0 });
        }
        await manager.createForUser({ discordId: 'owner', body: 'Unrelated', tags: ['movie'] });
        const page = await manager.inboxForUser('owner', { query: '100% raid_', tag: 'RAID', page: 2, pageSize: 5 });
        expect(page).toMatchObject({ total: 7, page: 2, pages: 2 });
        expect(page.notes).toHaveLength(2);
        expect((await manager.inboxForUser('owner', { query: 'missing' })).notes).toHaveLength(0);
        expect((await manager.inboxForUser('owner', { tag: 'movie' })).notes).toHaveLength(1);
    });

    it('rejects unsafe source URLs and oversized tags without changing saved state', async () => {
        const created = await manager.createForUser({ discordId: 'owner', body: 'Safe' });
        await expect(manager.updateForUser(created.id, 'owner', { sourceUrl: 'javascript:alert(1)' })).rejects.toThrow();
        await expect(manager.updateForUser(created.id, 'owner', { sourceUrl: 'https://user:secret@example.com/' })).rejects.toThrow();
        await expect(manager.updateForUser(created.id, 'owner', { tags: ['x'.repeat(33)] })).rejects.toThrow();
        expect(await manager.getForUser(created.id, 'owner')).toMatchObject({ sourceUrl: null, tags: [], status: 'unread' });
    });
});
