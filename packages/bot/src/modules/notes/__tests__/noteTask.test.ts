import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from 'discord.js';
import { createMockConfigManager } from '@zeffuro/fakegaming-common/testing';
import { PersonalError, type UserTaskBoard } from '@zeffuro/fakegaming-common/managers';
import { handleNoteComponent, renderNoteActions } from '../shared/noteInbox.js';
import { handleNoteTaskModal } from '../shared/noteTask.js';
import notesCommand from '../commands/notes.js';
import { renderTask } from '../../personal/commands/tasks.js';

vi.mock('../../../core/localization.js', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../core/localization.js')>();
    return { ...actual, resolveInteractionOutputLocale: vi.fn(async ({ locale }) => locale === 'nl' ? 'nl' : 'en') };
});

const noteId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const note = { id: noteId, discordId: 'owner', title: 'Saved request', body: 'Keep this', sourceUrl: 'https://discord.com/channels/1/2/3', linkedTaskId: null };
const task: UserTaskBoard = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', userId: 'owner', title: 'Send configuration', state: 'active',
    checklist: [], dueAt: null, timezone: 'Europe/Amsterdam', recurrence: null, reminderId: null, completedAt: null, completions: 0, version: 0,
    canUndo: false, sourceNoteId: noteId, sourceUrl: note.sourceUrl };

function setup(locale = 'en') {
    const getForUser = vi.fn().mockResolvedValue(note);
    const fromNote = vi.fn().mockResolvedValue({ task, created: true });
    const get = vi.fn().mockResolvedValue(task);
    createMockConfigManager({ userNoteManager: { getForUser }, userTaskManager: { fromNote, get },
        userManager: { getUser: vi.fn().mockResolvedValue({ timezone: 'Europe/Amsterdam' }) } });
    const interaction = { customId: `notes:task:${noteId}`, user: { id: 'owner' }, guildId: 'guild', locale,
        reply: vi.fn(), showModal: vi.fn(), deferReply: vi.fn(), editReply: vi.fn(),
        fields: { getTextInputValue: (key: string) => ({ title: 'Send configuration', due: '2026-10-23 12:30', timezone: 'Europe/Amsterdam' })[key] ?? '' } };
    return { interaction, getForUser, fromNote, get };
}

beforeEach(() => vi.clearAllMocks());

describe('note to private task controls', () => {
    it.each(['en', 'nl'] as const)('opens the localized editable title/date modal after an owner lookup: %s', async locale => {
        const { interaction, getForUser } = setup(locale);
        await handleNoteComponent(interaction as unknown as ButtonInteraction);
        expect(getForUser).toHaveBeenCalledWith(noteId, 'owner');
        expect(interaction.deferReply).not.toHaveBeenCalled();
        const modal = interaction.showModal.mock.calls[0]![0].toJSON();
        expect(modal.custom_id).toBe(interaction.customId);
        expect(modal.title).toBe(locale === 'nl' ? 'Taak uit opgeslagen notitie' : 'Task from saved note');
        expect(modal.components.map((row: { components: Array<{ custom_id: string; value?: string }> }) => row.components[0]?.custom_id)).toEqual(['title', 'due', 'timezone']);
        expect(modal.components[0].components[0].value).toBe(note.title);
        expect(modal.components[2].components[0].value).toBe('Europe/Amsterdam');
        expect(renderNoteActions(note, locale)[0]!.toJSON().components).toHaveLength(5);
        expect(notesCommand.handleModal).toBe(handleNoteTaskModal);
    });

    it('rechecks the submitting owner and saved timezone and renders a private task with a source link', async () => {
        const { interaction, fromNote } = setup();
        await handleNoteTaskModal(interaction as unknown as ModalSubmitInteraction);
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(fromNote).toHaveBeenCalledWith({ userId: 'owner', noteId, title: 'Send configuration', due: '2026-10-23 12:30', timezone: 'Europe/Amsterdam' });
        const payload = interaction.editReply.mock.calls[0]![0];
        expect(payload.content).toContain('original note is kept');
        expect(payload.allowedMentions).toEqual({ parse: [] });
        expect(payload.components[1].toJSON().components[0].url).toBe(note.sourceUrl);
    });

    it('opens a completed binding without creating another task', async () => {
        const { interaction, getForUser, fromNote, get } = setup();
        getForUser.mockResolvedValue({ ...note, linkedTaskId: task.id });
        get.mockResolvedValue({ ...task, state: 'completed' });
        await handleNoteComponent(interaction as unknown as ButtonInteraction);
        expect(get).toHaveBeenCalledWith(task.id, 'owner');
        expect(fromNote).not.toHaveBeenCalled();
        expect(interaction.showModal).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
    });

    it('denies other owners and malformed control IDs before any conversion', async () => {
        const { interaction, getForUser, fromNote } = setup();
        getForUser.mockResolvedValue(null);
        await handleNoteComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Note not found'), flags: MessageFlags.Ephemeral }));
        expect(interaction.showModal).not.toHaveBeenCalled();
        interaction.customId += ':extra';
        await handleNoteTaskModal(interaction as unknown as ModalSubmitInteraction);
        expect(fromNote).not.toHaveBeenCalled();
    });

    it('rejects edited/stale timezone input and reports a deleted binding without recreating it', async () => {
        const { interaction, fromNote } = setup('nl');
        interaction.fields.getTextInputValue = key => key === 'timezone' ? 'UTC' : key === 'title' ? 'Task' : '';
        await handleNoteTaskModal(interaction as unknown as ModalSubmitInteraction);
        expect(fromNote).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('tijdzone') }));
        interaction.fields.getTextInputValue = key => key === 'timezone' ? 'Europe/Amsterdam' : key === 'title' ? 'Task' : '';
        fromNote.mockRejectedValue(new PersonalError('stale'));
        await handleNoteTaskModal(interaction as unknown as ModalSubmitInteraction);
        expect(interaction.editReply).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.stringContaining('verwijderd of verlopen') }));
    });

    it('retains safe source buttons on completed tasks and suppresses unsafe links', () => {
        expect(renderTask({ ...task, state: 'completed' }, 'nl').components[0]!.toJSON().components[0]).toMatchObject({ url: note.sourceUrl, label: 'Oorspronkelijke bron' });
        expect(renderTask({ ...task, state: 'completed', sourceUrl: 'https://user:password@example.com' }, 'en').components).toEqual([]);
    });
});
