import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { getConfigManager, PersonalError } from '@zeffuro/fakegaming-common/managers';
import command from '../commands/polls.js';
import * as runtimeModule from '../shared/pollRuntime.js';
import dutch from '../../../messages/nl/pollTemplates.json' with { type: 'json' };

const saved = { id: 'saved', title: 'Dinner', question: 'Food?', options: ['Pizza', 'Pasta'], durationMinutes: 10, allowMultiple: false, hideResults: false, ranked: false, version: 3 };
function slash(action: string) {
    return {
        guildId: 'guild' as string | null, channelId: 'channel', locale: 'en-US', user: { id: 'owner' },
        deferReply: vi.fn().mockResolvedValue(undefined), editReply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue({ id: 'fresh-message', delete: vi.fn() }),
        options: { getSubcommand: () => action, getString: (name: string) => name === 'name' ? 'Dinner' : name === 'poll' ? 'old-message' : saved.id, getInteger: () => null },
    };
}
beforeEach(() => {
    const cm = getConfigManager();
    vi.spyOn(cm.userManager, 'getUser').mockResolvedValue(null);
    vi.spyOn(cm.guildLocaleConfigManager, 'getOutputLocale').mockResolvedValue('en');
});
afterEach(() => vi.restoreAllMocks());
describe('private reusable poll command', () => {
    it('uses the saved user language for private controls and the guild language for the public poll', async () => {
        const cm = getConfigManager();
        vi.spyOn(cm.userManager, 'getUser').mockResolvedValue({ preferredLocale: 'nl' } as Awaited<ReturnType<typeof cm.userManager.getUser>>);
        vi.spyOn(cm.guildLocaleConfigManager, 'getOutputLocale').mockResolvedValue('en');
        vi.spyOn(cm.pollTemplateManager, 'get').mockResolvedValue(saved);
        const start = vi.spyOn(cm.pollTemplateManager, 'start').mockResolvedValue({ id: 'fresh' } as Awaited<ReturnType<typeof cm.pollTemplateManager.start>>);
        vi.spyOn(runtimeModule, 'getPollRuntime').mockReturnValue({ manager: {}, track: vi.fn(), refresh: vi.fn().mockResolvedValue(undefined) } as unknown as runtimeModule.PollRuntime);
        const interaction = slash('start'); await command.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.editReply).toHaveBeenLastCalledWith(expect.objectContaining({ content: dutch.started }));
        expect(start).toHaveBeenCalledWith(saved.id, 'owner', saved.version, expect.anything(), expect.objectContaining({ locale: 'en' }));
    });
    it('saves only the invoking creator and keeps template replies private', async () => {
        const manager = getConfigManager().pollTemplateManager; const save = vi.spyOn(manager, 'savePoll').mockResolvedValue(saved);
        const interaction = slash('save'); await command.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(save).toHaveBeenCalledWith('owner', 'old-message', 'Dinner');
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ allowedMentions: { parse: [] } }));
        expect(interaction.followUp).not.toHaveBeenCalled();
    });
    it('settles the private deferred reply before publishing the fresh scoped poll and tracks recovery', async () => {
        const manager = getConfigManager().pollTemplateManager;
        vi.spyOn(manager, 'get').mockResolvedValue(saved);
        const created = { id: 'fresh' } as Awaited<ReturnType<typeof manager.start>>;
        const start = vi.spyOn(manager, 'start').mockResolvedValue(created);
        const runtime = { manager: { create: vi.fn() }, track: vi.fn(), refresh: vi.fn().mockRejectedValue(new Error('temporary render failure')) };
        vi.spyOn(runtimeModule, 'getPollRuntime').mockReturnValue(runtime as unknown as runtimeModule.PollRuntime);
        const interaction = slash('start'); await command.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.editReply.mock.invocationCallOrder[0]).toBeLessThan(interaction.followUp.mock.invocationCallOrder[0]!);
        expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ flags: [], allowedMentions: { parse: [] } }));
        expect(start).toHaveBeenCalledWith(saved.id, 'owner', 3, runtime.manager, { guildId: 'guild', channelId: 'channel', messageId: 'fresh-message', locale: 'en' });
        expect(runtime.track).toHaveBeenCalledWith(created); expect(runtime.refresh).toHaveBeenCalledWith('fresh');
        expect(interaction.editReply).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'Your fresh poll was posted in this channel.' }));
    });
    it('deletes an unused public placeholder if a template changes before creation', async () => {
        const manager = getConfigManager().pollTemplateManager;
        vi.spyOn(manager, 'get').mockResolvedValue(saved); vi.spyOn(manager, 'start').mockRejectedValue(new PersonalError('stale'));
        vi.spyOn(runtimeModule, 'getPollRuntime').mockReturnValue({ manager: {}, track: vi.fn() } as unknown as runtimeModule.PollRuntime);
        const interaction = slash('start'); const remove = vi.fn().mockResolvedValue(undefined);
        interaction.followUp.mockResolvedValue({ id: 'fresh-message', delete: remove });
        await command.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(remove).toHaveBeenCalledOnce();
        expect(interaction.editReply).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.stringContaining('changed') }));
    });
    it('shows saved settings without creating a public poll and requires owner lookup', async () => {
        const get = vi.spyOn(getConfigManager().pollTemplateManager, 'get').mockResolvedValue(saved);
        const interaction = slash('show'); await command.execute(interaction as unknown as ChatInputCommandInteraction);
        expect(get).toHaveBeenCalledWith('saved', 'owner'); expect(interaction.followUp).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Hide results: No') }));
    });
});
