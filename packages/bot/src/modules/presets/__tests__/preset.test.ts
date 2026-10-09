import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';

const mocks = vi.hoisted(() => ({
    save: vi.fn(), get: vi.fn(), list: vi.fn(), remove: vi.fn(), commandDisabled: vi.fn(), moduleDisabled: vi.fn(),
}));
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({
    userCommandPresetManager: { save: mocks.save, get: mocks.get, list: mocks.list, remove: mocks.remove },
    guildLocaleConfigManager: { getOutputLocale: async () => 'en' },
    userManager: { getUser: async () => null },
    disabledCommandManager: { isCommandDisabled: mocks.commandDisabled }, disabledModuleManager: { isModuleDisabled: mocks.moduleDisabled },
}) }));
import preset from '../commands/preset.js';

function interaction(action: string, values: Record<string, string> = {}): ChatInputCommandInteraction {
    return { guildId: 'guild', user: { id: 'owner' }, commandName: 'preset', options: {
        getSubcommand: () => action, getString: (name: string) => values[name] ?? null, getInteger: () => null,
    }, client: { commands: new Map() }, deferReply: vi.fn(), editReply: vi.fn(), followUp: vi.fn(), reply: vi.fn() } as unknown as ChatInputCommandInteraction;
}

describe('private command presets', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.commandDisabled.mockResolvedValue(false); mocks.moduleDisabled.mockResolvedValue(false);
        mocks.get.mockResolvedValue({ commandPath: 'weather', argumentsJson: '{"location":"Amsterdam"}' });
    });

    function target(current: ChatInputCommandInteraction, execute = vi.fn(async (_input: unknown): Promise<void> => undefined)) {
        const commands = current.client as unknown as { commands: Map<string, unknown> };
        commands.commands.set('weather', { moduleName: 'general', data: { name: 'weather', toJSON: () => ({ options: [{ type: 3, name: 'location', required: true }] }) }, execute });
        return execute;
    }

    it('saves validated options and invokes the lookup with saved values as the same private user', async () => {
        const save = interaction('save', { name: 'home', command: 'weather', options: 'location:Amsterdam' });
        target(save);
        await preset.execute(save);
        expect(save.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(mocks.save).toHaveBeenCalledWith('owner', 'home', 'weather', { location: 'Amsterdam' });
        const run = interaction('run', { name: 'home' });
        const execute = vi.fn(async (input: unknown) => {
            const wrapped = input as ChatInputCommandInteraction;
            expect(wrapped.options.getString('location', true)).toBe('Amsterdam');
            expect(wrapped.user.id).toBe('owner');
            await wrapped.reply('weather');
        });
        target(run, execute);
        await preset.execute(run);
        expect(mocks.get).toHaveBeenCalledWith('owner', 'home');
        expect(execute).toHaveBeenCalledOnce();
        expect(run.reply).not.toHaveBeenCalled();
        expect(run.editReply).toHaveBeenCalledWith({ content: 'weather', allowedMentions: { parse: [] } });
    });

    it.each(['command', 'module'])('rechecks the target %s gate at run time', async gate => {
        const current = interaction('run', { name: 'home' });
        const execute = target(current);
        (gate === 'command' ? mocks.commandDisabled : mocks.moduleDisabled).mockResolvedValue(true);
        await preset.execute(current);
        expect(execute).not.toHaveBeenCalled();
        expect(current.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('disabled') }));
    });

    it('does not allocate invalid presets or leak another user through autocomplete', async () => {
        const current = interaction('save', { name: 'home', command: 'weather', options: 'unknown:value' });
        target(current); await preset.execute(current);
        expect(mocks.save).not.toHaveBeenCalled();
        mocks.list.mockResolvedValue([{ name: 'home' }, { name: 'work' }]);
        const auto = { user: { id: 'owner' }, options: { getFocused: () => 'ho' }, respond: vi.fn() } as unknown as AutocompleteInteraction;
        await preset.autocomplete(auto);
        expect(mocks.list).toHaveBeenCalledWith('owner');
        expect(auto.respond).toHaveBeenCalledWith([{ name: 'home', value: 'home' }]);
    });
});
