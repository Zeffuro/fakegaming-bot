import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';

const mocks = vi.hoisted(() => ({ add: vi.fn(), list: vi.fn(), change: vi.fn(), configure: vi.fn(), preferences: vi.fn(), twitch: vi.fn(), steam: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({
    userFollowManager: { add: mocks.add, list: mocks.list, change: mocks.change, configure: mocks.configure, preferences: mocks.preferences },
    userManager: { getUser: async () => ({ timezone: 'Europe/Amsterdam' }) }, guildLocaleConfigManager: { getOutputLocale: async () => 'en' },
}) }));
vi.mock('@zeffuro/fakegaming-common/notifications', () => ({ findPersonalTwitchUser: mocks.twitch }));
vi.mock('@zeffuro/fakegaming-common/steam', () => ({ resolveSteamAppInput: mocks.steam, searchSteamApps: vi.fn() }));
import follows from '../commands/follows.js';

function interaction(action: string, values: Record<string, string> = {}): ChatInputCommandInteraction {
    return { guildId: 'guild', user: { id: 'owner' }, options: {
        getSubcommand: () => action, getString: (name: string) => values[name] ?? null, getInteger: () => null, getBoolean: () => null,
    }, deferReply: vi.fn(), editReply: vi.fn() } as unknown as ChatInputCommandInteraction;
}

describe('personal follow commands', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.preferences.mockResolvedValue({ timezone: 'Europe/Amsterdam', quietStart: null, quietEnd: null, digestAt: '09:00' });
        mocks.steam.mockResolvedValue({ status: 'resolved', app: { steamAppId: 730, appName: 'Counter-Strike' } });
        mocks.twitch.mockResolvedValue({ login: 'example', display_name: 'Example' });
    });

    it('creates private game follows with provider identity and selected delivery mode', async () => {
        const current = interaction('steam', { game: 'Counter-Strike', mode: 'digest' });
        await follows.execute(current);
        expect(current.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(mocks.add).toHaveBeenCalledWith('owner', 'steam', '730', 'Counter-Strike', 'digest');
        expect(mocks.preferences).toHaveBeenCalledWith('owner', 'Europe/Amsterdam');
    });

    it('does not save unresolved or ambiguous identities', async () => {
        mocks.twitch.mockResolvedValueOnce(null);
        await follows.execute(interaction('twitch', { username: 'unknown' }));
        mocks.steam.mockResolvedValueOnce({ status: 'ambiguous' });
        await follows.execute(interaction('steam', { game: 'ambiguous' }));
        expect(mocks.add).not.toHaveBeenCalled();
    });

    it('requires both quiet-hour boundaries and keeps every mutation scoped to the invoker', async () => {
        const invalid = interaction('settings', { 'quiet-start': '22:00' });
        await follows.execute(invalid);
        expect(mocks.configure).not.toHaveBeenCalled();
        const valid = interaction('settings', { 'quiet-start': '22:00', 'quiet-end': '07:00', 'digest-at': '08:00' });
        await follows.execute(valid);
        expect(mocks.configure).toHaveBeenCalledWith('owner', { timezone: 'Europe/Amsterdam', quietStart: '22:00', quietEnd: '07:00', digestAt: '08:00' });
        mocks.change.mockResolvedValue(false);
        const other = interaction('remove', { id: 'not-owned' });
        await follows.execute(other);
        expect(mocks.change).toHaveBeenCalledWith('owner', 'not-owned', 'remove');
        expect(other.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('does not belong') }));
    });

    it('only offers follows owned by the current user in autocomplete', async () => {
        mocks.list.mockResolvedValue([{ id: 'own', label: 'Example', provider: 'twitch' }]);
        const auto = { user: { id: 'owner' }, options: { getFocused: () => ({ name: 'id', value: 'exa' }) }, respond: vi.fn() } as unknown as AutocompleteInteraction;
        await follows.autocomplete(auto);
        expect(mocks.list).toHaveBeenCalledWith('owner');
        expect(auto.respond).toHaveBeenCalledWith([{ name: 'Example (twitch)', value: 'own' }]);
    });
});
