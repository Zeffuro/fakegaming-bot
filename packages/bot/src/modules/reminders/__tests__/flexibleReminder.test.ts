import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, MessageContextMenuCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import { parseReminderTime } from '@zeffuro/fakegaming-common/utils';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { createFlexibleReminderHandlers } from '../commands/flexibleReminder.js';

vi.mock('@zeffuro/fakegaming-common/utils', () => ({ parseReminderTime: vi.fn() }));
vi.mock('../../../core/localization.js', async importOriginal => {
    const original = await importOriginal<typeof import('../../../core/localization.js')>();
    return { ...original, resolveInteractionOutputLocale: vi.fn().mockResolvedValue('en') };
});

const id = '12345678-1234-1234-1234-123456789abc';
type Manager = Parameters<typeof createFlexibleReminderHandlers>[0];
type Users = Parameters<typeof createFlexibleReminderHandlers>[1];

function setup(customId = `reminder:draft:${id}:600`) {
    const manager = {
        createDraft: vi.fn().mockResolvedValue({ id }),
        getDraft: vi.fn().mockResolvedValue({ id, userId: 'owner', message: 'message' }),
        scheduleDraft: vi.fn().mockResolvedValue(true),
        getDelivery: vi.fn().mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: 'dm-message', channelId: 'dm-channel', status: 'delivered' }),
        snoozeDelivery: vi.fn().mockResolvedValue(true),
        dismissDelivery: vi.fn().mockResolvedValue(true),
        recoverDelivery: vi.fn().mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: 'dm-message', channelId: 'dm-channel', status: 'delivered' }),
    };
    const users = { getUser: vi.fn().mockResolvedValue({ timezone: 'Europe/Amsterdam' }) };
    const interaction = {
        customId, guildId: null as string | null, channelId: 'dm-channel', user: { id: 'owner' },
        client: { user: { id: 'bot' } },
        message: { id: 'dm-message', author: { id: 'bot' }, edit: vi.fn().mockResolvedValue(undefined) },
        deferred: false, reply: vi.fn(), editReply: vi.fn(), showModal: vi.fn(),
        deferReply: vi.fn().mockImplementation(async () => { interaction.deferred = true; }),
        fields: { getTextInputValue: vi.fn((key: string): string => key === 'when' ? '2026-10-08 19:30' : '') },
    };
    return { manager, users, interaction, handlers: createFlexibleReminderHandlers(manager as unknown as Manager, users as unknown as Users) };
}

describe('flexible message reminders', () => {
    beforeEach(() => {
        vi.mocked(parseReminderTime).mockReturnValue({ timestamp: 1_800_000_000_000, timespan: '10m' });
    });

    it('persists a draft and renders bounded quick choices', async () => {
        const { manager, interaction, handlers } = setup();
        const context = { ...interaction, guildId: 'guild', targetMessage: { url: 'https://discord.com/channels/guild/channel/message' } };
        await handlers.execute(context as unknown as MessageContextMenuCommandInteraction);
        expect(manager.createDraft).toHaveBeenCalledWith('owner', 'Follow up on this message: https://discord.com/channels/guild/channel/message');
        const row = interaction.editReply.mock.calls[0]![0].components[0].toJSON();
        expect(row.components.map((button: { custom_id: string }) => button.custom_id)).toEqual([
            `reminder:draft:${id}:600`, `reminder:draft:${id}:3600`, `reminder:draft:${id}:tomorrow`, `reminder:custom-draft:${id}`,
        ]);
    });

    it('schedules a quick choice with the saved timezone', async () => {
        const { manager, interaction, handlers } = setup();
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(parseReminderTime).toHaveBeenCalledWith('600s', 'Europe/Amsterdam');
        expect(manager.scheduleDraft).toHaveBeenCalledWith(id, 'owner', 1_800_000_000_000, '10m');
        expect(interaction.deferReply).toHaveBeenCalledBefore(manager.getDraft);
        expect(interaction.deferReply).toHaveBeenCalledBefore(vi.mocked(resolveInteractionOutputLocale));
        expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    });

    it('rejects another owner or an expired draft', async () => {
        const { manager, interaction, handlers } = setup();
        manager.getDraft.mockResolvedValue(null as never);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.scheduleDraft).not.toHaveBeenCalled();
        expect(manager.getDraft).toHaveBeenCalledWith(id, 'owner');
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('expired') }));
    });

    it('reports an atomic duplicate without claiming another schedule', async () => {
        const { manager, interaction, handlers } = setup();
        manager.scheduleDraft.mockResolvedValue(false);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('already used') }));
    });

    it('opens a custom modal only after verifying the draft owner', async () => {
        const { interaction, handlers } = setup(`reminder:custom-draft:${id}`);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        const modal = interaction.showModal.mock.calls[0]![0].toJSON();
        expect(modal.custom_id).toBe(`reminder:custom-draft:${id}`);
        expect(modal.components).toHaveLength(2);
        expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it('rechecks the draft when a custom modal is submitted', async () => {
        const { manager, interaction, handlers } = setup(`reminder:custom-draft:${id}`);
        manager.getDraft.mockResolvedValue(null as never);
        await handlers.handleModal(interaction as unknown as ModalSubmitInteraction);
        expect(manager.scheduleDraft).not.toHaveBeenCalled();
    });

    it('parses exact custom time with a timezone override', async () => {
        const { interaction, handlers, users } = setup(`reminder:custom-draft:${id}`);
        interaction.fields.getTextInputValue.mockImplementation(key => key === 'when' ? '2026-10-08 19:30' : 'UTC');
        await handlers.handleModal(interaction as unknown as ModalSubmitInteraction);
        expect(parseReminderTime).toHaveBeenCalledWith('2026-10-08 19:30', 'UTC');
        expect(users.getUser).not.toHaveBeenCalled();
    });

    it('keeps the draft usable after invalid input', async () => {
        const { interaction, handlers, manager } = setup(`reminder:custom-draft:${id}`);
        vi.mocked(parseReminderTime).mockReturnValue(null);
        await handlers.handleModal(interaction as unknown as ModalSubmitInteraction);
        expect(manager.scheduleDraft).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Invalid time') }));
    });

    it.each(['wrong-message', null])('rejects snoozing a copied or missing DM message: %s', async messageId => {
        const { interaction, manager, handlers } = setup(`reminder:snooze:${id}:600`);
        manager.getDelivery.mockResolvedValue({ id, userId: 'owner', message: 'message', messageId, channelId: 'dm-channel', status: 'delivered' } as never);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.snoozeDelivery).not.toHaveBeenCalled();
    });

    it('snoozes an original delivered DM and removes controls', async () => {
        const { interaction, manager, handlers } = setup(`reminder:snooze:${id}:3600`);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.snoozeDelivery).toHaveBeenCalledWith(id, 'owner', 1_800_000_000_000, '10m', 'dm-message', 'dm-channel');
        expect(interaction.message.edit).toHaveBeenCalledWith({ components: [] });
    });

    it('rechecks custom snooze status when submitting the modal', async () => {
        const { interaction, manager, handlers } = setup(`reminder:custom-snooze:${id}`);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.showModal).toHaveBeenCalled();
        manager.getDelivery.mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: 'dm-message', channelId: 'dm-channel', status: 'snoozed' });
        await handlers.handleModal(interaction as unknown as ModalSubmitInteraction);
        expect(manager.snoozeDelivery).not.toHaveBeenCalled();
    });

    it('rejects a delivery with a different owner or channel', async () => {
        const { interaction, manager, handlers } = setup(`reminder:custom-snooze:${id}`);
        manager.getDelivery.mockResolvedValue({ id, userId: 'someone-else', message: 'message', messageId: 'dm-message', channelId: 'dm-channel', status: 'delivered' });
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.showModal).not.toHaveBeenCalled();
        manager.getDelivery.mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: 'dm-message', channelId: 'other-channel', status: 'delivered' });
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('dismisses the original delivered DM atomically', async () => {
        const { interaction, manager, handlers } = setup(`reminder:dismiss:${id}`);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.dismissDelivery).toHaveBeenCalledWith(id, 'owner', 'dm-message', 'dm-channel');
        expect(interaction.message.edit).toHaveBeenCalledWith({ components: [] });
        expect(interaction.deferReply).toHaveBeenCalledBefore(vi.mocked(resolveInteractionOutputLocale));
    });

    it.each(['sending', 'uncertain'])('recovers a bot-authored DM in %s status before snoozing', async status => {
        const { interaction, manager, handlers } = setup(`reminder:snooze:${id}:600`);
        manager.getDelivery.mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: null, channelId: null, status } as never);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.recoverDelivery).toHaveBeenCalledWith(id, 'owner', 'dm-message', 'dm-channel');
        expect(manager.snoozeDelivery).toHaveBeenCalled();
        expect(interaction.deferReply).toHaveBeenCalledBefore(manager.getDelivery);
    });

    it('requires the bot author before recovery', async () => {
        const { interaction, manager, handlers } = setup(`reminder:custom-snooze:${id}`);
        manager.getDelivery.mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: null, channelId: null, status: 'uncertain' } as never);
        interaction.message.author.id = 'someone-else';
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.recoverDelivery).not.toHaveBeenCalled();
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('requires stored ownership before recovery', async () => {
        const { interaction, manager, handlers } = setup(`reminder:snooze:${id}:600`);
        manager.getDelivery.mockResolvedValue({ id, userId: 'someone-else', message: 'message', messageId: null, channelId: null, status: 'sending' } as never);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.recoverDelivery).not.toHaveBeenCalled();
        expect(manager.snoozeDelivery).not.toHaveBeenCalled();
    });

    it('rechecks recovery binding before using the delivery', async () => {
        const { interaction, manager, handlers } = setup(`reminder:snooze:${id}:600`);
        manager.getDelivery.mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: null, channelId: null, status: 'uncertain' } as never);
        manager.recoverDelivery.mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: 'other-message', channelId: 'dm-channel', status: 'delivered' });
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.snoozeDelivery).not.toHaveBeenCalled();
    });

    it('handles an unsuccessful recovery without using the delivery', async () => {
        const { interaction, manager, handlers } = setup(`reminder:dismiss:${id}`);
        manager.getDelivery.mockResolvedValue({ id, userId: 'owner', message: 'message', messageId: null, channelId: null, status: 'uncertain' } as never);
        manager.recoverDelivery.mockResolvedValue(null as never);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.dismissDelivery).not.toHaveBeenCalled();
    });

    it('rejects delivery buttons used inside a guild', async () => {
        const { interaction, manager, handlers } = setup(`reminder:custom-snooze:${id}`);
        interaction.guildId = 'guild';
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.getDelivery).not.toHaveBeenCalled();
        expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('rejects malformed or unsupported actions', async () => {
        const { interaction, manager, handlers } = setup(`reminder:draft:${id}:5`);
        await handlers.handleComponent(interaction as unknown as ButtonInteraction);
        expect(manager.scheduleDraft).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalled();
    });
});

