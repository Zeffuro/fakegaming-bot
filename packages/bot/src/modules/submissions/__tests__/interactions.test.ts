import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags, type ChatInputCommandInteraction, type ModalSubmitInteraction } from 'discord.js';
import { createSubmissionHandlers } from '../shared/interactions.js';
import * as access from '../shared/access.js';
import { mockManager, record, category, interaction, userId, itemId, guildId } from './fixtures.js';

vi.mock('../shared/access.js', async () => {
    const actual = await vi.importActual<typeof import('../shared/access.js')>('../shared/access.js');
    return { ...actual, requireSubmissionsEnabled: vi.fn(async (guild: string | null) => {
        if (!guild) throw Object.assign(new Error(), { code: 'unavailable' });
        return guild;
    }), requireReviewer: vi.fn(async () => ({ category: { version: 0 } })), liveMember: vi.fn() };
});

const runtime = { submit: vi.fn(), publish: vi.fn(), reconcile: vi.fn(), refresh: vi.fn(async () => undefined), notify: vi.fn(async () => undefined) };
const handlers = (manager = mockManager()) => createSubmissionHandlers(manager, () => runtime as never);
beforeEach(() => { vi.mocked(access.requireReviewer).mockResolvedValue({ category: { version: 0 } } as never); });

describe('submission interaction boundaries', () => {
    it('opens the configured categories with no network request before acknowledging a form', async () => {
        const manager = mockManager();
        const control = interaction('submissions:submit', { channelId: 'panel-channel', message: {
            id: 'panel-message', author: { id: '100000000000000003' }, flags: { has: () => false },
        } });
        await handlers(manager).handleComponent(control);
        expect(control.showModal).toHaveBeenCalledTimes(1);
        expect(control.deferReply).not.toHaveBeenCalled();
        expect(access.requireReviewer).not.toHaveBeenCalled();
        expect(control.showModal.mock.calls[0]?.[0]?.toJSON().custom_id).toBe('submissions:new');
    });

    it('filters categories using the current interaction role snapshot', async () => {
        const manager = mockManager({ listCategories: vi.fn(async () => [category({ submitterRoleIds: ['other-role'] })]) });
        const control = interaction('submissions:submit', { channelId: 'panel-channel', message: {
            id: 'panel-message', author: { id: '100000000000000003' }, flags: { has: () => false },
        } });
        await handlers(manager).handleComponent(control);
        expect(control.showModal).not.toHaveBeenCalled();
        expect(control.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
    });

    it('rejects forged or replaced entrance panels', async () => {
        const control = interaction('submissions:submit');
        await handlers().handleComponent(control);
        expect(control.showModal).not.toHaveBeenCalled();
    });

    it('acknowledges approval before live Discord permissions are fetched', async () => {
        const control = interaction(`submissions:approve:${itemId}:1`);
        runtime.publish.mockResolvedValue(record({ status: 'published' }));
        await handlers().handleComponent(control);
        expect(control.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(control.deferReply.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(access.requireReviewer).mock.invocationCallOrder[0]!);
        expect(runtime.publish).toHaveBeenCalledWith(record(), userId);
    });

    it('binds moderator actions to the exact persisted review channel and message', async () => {
        const control = interaction(`submissions:approve:${itemId}:1`, { channelId: 'somewhere-else' });
        await handlers().handleComponent(control);
        expect(runtime.publish).not.toHaveBeenCalled();
        expect(access.requireReviewer).not.toHaveBeenCalled();
    });

    it('rejects stale review buttons without publishing', async () => {
        const control = interaction(`submissions:approve:${itemId}:0`);
        await handlers().handleComponent(control);
        expect(runtime.publish).not.toHaveBeenCalled();
        expect(control.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('changed') }));
    });

    it('rechecks reviewer access when a reason form is submitted', async () => {
        const manager = mockManager({ review: vi.fn() });
        const control = interaction(`submissions:changes:${itemId}:1`);
        vi.mocked(access.requireReviewer).mockRejectedValueOnce(Object.assign(new Error('Revoked'), { code: 'missing' }));
        await handlers(manager).handleModal(control as unknown as ModalSubmitInteraction);
        expect(manager.review).not.toHaveBeenCalled();
        expect(runtime.notify).not.toHaveBeenCalled();
    });

    it('requests changes with a private reason and updates the queue and owner notification', async () => {
        const updated = record({ status: 'changes_requested', reason: 'Please censor the name', version: 2 });
        const manager = mockManager({ review: vi.fn(async () => updated) });
        const control = interaction(`submissions:changes:${itemId}:1`);
        await handlers(manager).handleModal(control as unknown as ModalSubmitInteraction);
        expect(manager.review).toHaveBeenCalledWith(guildId, itemId, 1, userId, 'changes', 'Please censor the name', 0);
        expect(runtime.notify).toHaveBeenCalledWith(updated);
        expect(JSON.stringify(control.editReply.mock.calls)).not.toContain('Please censor');
    });

    it('prevents another member from viewing or editing an owner submission', async () => {
        const manager = mockManager({ get: vi.fn(async () => record({ userId: 'another-person' })) });
        const control = interaction(`submissions:show:${itemId}`);
        await handlers(manager).handleComponent(control);
        expect(control.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('no longer available') }));
        expect(JSON.stringify(control.editReply.mock.calls)).not.toContain('A funny screenshot');
    });

    it('rejects owner controls if copied into an ordinary channel message', async () => {
        const control = interaction(`submissions:edit:${itemId}:1`, { message: {
            id: '100000000000000007', author: { id: '100000000000000003' }, flags: { has: () => false },
        } });
        await handlers().handleComponent(control);
        expect(control.showModal).not.toHaveBeenCalled();
    });

    it('keeps an owner revision in its original configured category', async () => {
        const manager = mockManager({ get: vi.fn(async () => record({ status: 'changes_requested' })),
            getCategory: vi.fn(async () => category({ id: 'other-category' })) });
        const control = interaction(`submissions:revision:${itemId}:1`);
        await handlers(manager).handleModal(control as unknown as ModalSubmitInteraction);
        expect(runtime.submit).not.toHaveBeenCalled();
    });

    it('passes screenshot-only submissions to the upload pipeline without inventing a link or credit', async () => {
        const manager = mockManager();
        const control = interaction('submissions:new');
        await handlers(manager).handleModal(control as unknown as ModalSubmitInteraction);
        expect(runtime.submit).toHaveBeenCalledWith(category(), userId,
            { explanation: 'A funny screenshot', link: null, credit: null, attachmentCount: 0 }, [], undefined);
        expect(control.deferReply).toHaveBeenCalledTimes(1);
    });

    it('lists only the current guild and owner and does not depend on DMs', async () => {
        const manager = mockManager();
        const control = interaction('submissions:mine:0');
        await handlers(manager).handleComponent(control);
        expect(manager.listOwn).toHaveBeenCalledWith(guildId, userId, 0);
        expect(runtime.notify).not.toHaveBeenCalled();
    });

    it('does not accept a panel administration command from ordinary members', async () => {
        const manager = mockManager({ setPanel: vi.fn() });
        vi.mocked(access.liveMember).mockResolvedValueOnce({ permissions: { has: () => false } } as never);
        const control = interaction('', { options: { getSubcommand: () => 'panel' }, client: {
            user: { id: 'bot' }, guilds: { fetch: vi.fn(async () => ({})) },
        } });
        await handlers(manager).execute(control as unknown as ChatInputCommandInteraction);
        expect(manager.setPanel).not.toHaveBeenCalled();
    });

    it('declines components from other namespaces', async () => {
        expect(await handlers().handleComponent(interaction('poll:vote:1'))).toBe(false);
    });
});
