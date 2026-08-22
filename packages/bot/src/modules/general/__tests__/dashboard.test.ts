import type { ChatInputCommandInteraction } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectEphemeralReply, setupCommandTest } from '@zeffuro/fakegaming-common/testing';

describe('dashboard command', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('links directly to the current server using the configured public URL', async () => {
        vi.stubEnv('DASHBOARD_URL', 'https://fakegaming.eu/');
        const { command, interaction } = await setupCommandTest('modules/general/commands/dashboard.js', {
            interaction: { guildId: '135381928284343204' },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        const payload = vi.mocked(interaction.reply).mock.calls[0]?.[0] as {
            content?: string;
            components?: Array<{ toJSON(): unknown }>;
        };
        expect(payload.content).toBe('Manage this server on the bot dashboard:');
        expect(payload.components?.[0]?.toJSON()).toMatchObject({
            components: [{ style: 5, label: 'Open dashboard', url: 'https://fakegaming.eu/dashboard/135381928284343204' }],
        });
    });

    it('uses the local dashboard during development', async () => {
        vi.stubEnv('DASHBOARD_URL', '');
        vi.stubEnv('NODE_ENV', 'development');
        const module = await import('../commands/dashboard.js');

        expect(module.getDashboardGuildUrl('123')).toBe('http://localhost:3000/dashboard/123');
    });

    it('reports a missing production URL without posting a localhost link', async () => {
        vi.stubEnv('DASHBOARD_URL', '');
        vi.stubEnv('NODE_ENV', 'production');
        const { command, interaction } = await setupCommandTest('modules/general/commands/dashboard.js', {
            interaction: { guildId: '135381928284343204' },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expectEphemeralReply(interaction, { equals: 'The public dashboard URL is not configured for this bot.' });
    });

    it('rejects direct-message use', async () => {
        const { command, interaction } = await setupCommandTest('modules/general/commands/dashboard.js', {
            interaction: { guildId: null },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expectEphemeralReply(interaction, { equals: 'Dashboard links only work in a server.' });
    });
});
