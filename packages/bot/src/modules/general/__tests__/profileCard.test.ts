import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { renderProfileCard } from '@zeffuro/fakegaming-common/profile-card';

vi.mock('@zeffuro/fakegaming-common/profile-card', () => ({
    buildProfileCardFilename: vi.fn((userId: string) => `profile-card-${userId}.png`),
    renderProfileCard: vi.fn(() => Buffer.from('fake-png')),
}));

vi.mock('discord.js', async (importOriginal) => {
    const actual = await importOriginal();
    return Object.assign({}, actual, {
        AttachmentBuilder: vi.fn().mockImplementation((_buffer: Buffer, options: { name: string }) => ({
            name: options.name,
        })),
    });
});

describe('profile-card command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a profile card for the selected user', async () => {
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/profileCard.js',
            {
                interaction: {
                    userOptions: { user: 'target-123' },
                    guildId: 'guild-1',
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(renderProfileCard).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'target-123',
            displayName: 'testuser',
            username: 'testuser',
            discriminator: '0001',
            guildName: 'Test Guild',
        }));
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Profile card for <@target-123>',
            files: [expect.objectContaining({ name: 'profile-card-target-123.png' })],
        }));
    });
});
