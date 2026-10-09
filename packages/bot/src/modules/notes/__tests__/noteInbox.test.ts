import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { createMockConfigManager } from '@zeffuro/fakegaming-common/testing';
import { handleNoteComponent, renderNoteDetails } from '../shared/noteInbox.js';
import { createFlexibleReminderHandlers } from '../../reminders/commands/flexibleReminder.js';

vi.mock('../../../core/localization.js', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../core/localization.js')>();
    return { ...actual, resolveInteractionOutputLocale: vi.fn().mockResolvedValue('en') };
});

const note = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', discordId: 'owner', title: 'Read later', body: 'Useful saved text',
    tags: ['games'], sourceUrl: 'https://example.com/', status: 'unread' as const,
};

function setup(action = 'open') {
    const getForUser = vi.fn().mockResolvedValue(note);
    const updateForUser = vi.fn().mockImplementation(async (_id, _user, update) => ({ ...note, ...update }));
    const createDraft = vi.fn().mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' });
    createMockConfigManager({ userNoteManager: { getForUser, updateForUser }, reminderInteractionManager: { createDraft } });
    const interaction = {
        customId: `notes:${action}:${note.id}`, user: { id: 'owner' }, guildId: null,
        deferReply: vi.fn(), editReply: vi.fn(),
    };
    return { interaction, getForUser, updateForUser, createDraft };
}

describe('persisted inbox controls', () => {
    beforeEach(() => vi.clearAllMocks());

    it('loads a note by owner and ID without any in-memory session and marks it read', async () => {
        const { interaction, getForUser, updateForUser } = setup();
        await handleNoteComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.deferReply).toHaveBeenCalledBefore(getForUser);
        expect(getForUser).toHaveBeenCalledWith(note.id, 'owner');
        expect(updateForUser).toHaveBeenCalledWith(note.id, 'owner', { status: 'read' });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Useful saved text') }));
    });

    it.each(['open', 'archive', 'restore', 'remind'])('rejects stale or other-owner %s controls', async action => {
        const { interaction, getForUser, updateForUser, createDraft } = setup(action);
        getForUser.mockResolvedValue(null);
        await handleNoteComponent(interaction as unknown as ButtonInteraction);
        expect(updateForUser).not.toHaveBeenCalled();
        expect(createDraft).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Note not found') }));
    });

    it('archives and renders the persisted restore action', async () => {
        const { interaction, updateForUser } = setup('archive');
        await handleNoteComponent(interaction as unknown as ButtonInteraction);
        expect(updateForUser).toHaveBeenCalledWith(note.id, 'owner', { status: 'archived' });
        const controls = interaction.editReply.mock.calls[0]![0].components[0].toJSON().components;
        expect(controls.map((button: { custom_id?: string }) => button.custom_id)).toContain(`notes:restore:${note.id}`);
    });

    it('creates a durable reminder draft with existing quick and exact-time modal routes', async () => {
        const { interaction, createDraft } = setup('remind');
        await handleNoteComponent(interaction as unknown as ButtonInteraction);
        expect(createDraft).toHaveBeenCalledWith('owner', expect.stringContaining(note.sourceUrl));
        const controls = interaction.editReply.mock.calls[0]![0].components[0].toJSON().components;
        expect(controls.map((button: { custom_id: string }) => button.custom_id)).toEqual([
            'reminder:draft:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:600',
            'reminder:draft:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:3600',
            'reminder:draft:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:tomorrow',
            'reminder:custom-draft:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        ]);
    });

    it('bounds large note details and omits unsafe source links', () => {
        const payload = renderNoteDetails({ ...note, body: 'x'.repeat(20000), tags: Array.from({ length: 10 }, () => 'y'.repeat(32)), sourceUrl: 'javascript:alert(1)' }, 'en');
        expect(payload.content.length).toBeLessThanOrEqual(2000);
        expect(payload.allowedMentions).toEqual({ parse: [] });
        expect(payload.components[0]!.toJSON().components.every(button => button.type !== 2 || !('url' in button))).toBe(true);
    });

    it('uses the reminder custom modal to schedule the saved note at an exact UTC time', async () => {
        const { interaction } = setup('remind');
        await handleNoteComponent(interaction as unknown as ButtonInteraction);
        const customId = interaction.editReply.mock.calls[0]![0].components[0].toJSON().components[3].custom_id;
        const scheduleDraft = vi.fn().mockResolvedValue(true);
        const reminderManager = {
            getDraft: vi.fn().mockResolvedValue({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', userId: 'owner', message: note.body }),
            scheduleDraft,
        };
        const handlers = createFlexibleReminderHandlers(
            reminderManager as unknown as Parameters<typeof createFlexibleReminderHandlers>[0],
            { getUser: vi.fn().mockResolvedValue({ timezone: 'UTC' }) } as unknown as Parameters<typeof createFlexibleReminderHandlers>[1],
        );
        const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
        const modal = {
            ...interaction, customId, deferred: false,
            fields: { getTextInputValue: (key: string) => key === 'when' ? `${date} 19:30` : 'UTC' },
        };
        await handlers.handleModal(modal as unknown as ModalSubmitInteraction);
        expect(reminderManager.getDraft).toHaveBeenCalledWith('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');
        expect(scheduleDraft).toHaveBeenCalledWith('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', Date.parse(`${date}T19:30:00Z`), expect.any(String));
    });
});
