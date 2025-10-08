import { describe, it, expect, vi } from 'vitest';
import { requireAdmin } from '../permissions.js';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';

describe('permissions', () => {
    describe('requireAdmin', () => {
        it('should return true when user has administrator permissions', async () => {
            const interaction = {
                memberPermissions: {
                    has: vi.fn().mockReturnValue(true),
                },
                reply: vi.fn(),
            } as unknown as ChatInputCommandInteraction;

            const result = await requireAdmin(interaction);

            expect(result).toBe(true);
            expect(interaction.memberPermissions?.has).toHaveBeenCalledWith(PermissionFlagsBits.Administrator);
            expect(interaction.reply).not.toHaveBeenCalled();
        });

        it('should return false and reply when user does not have administrator permissions', async () => {
            const interaction = {
                memberPermissions: {
                    has: vi.fn().mockReturnValue(false),
                },
                reply: vi.fn(),
            } as unknown as ChatInputCommandInteraction;

            const result = await requireAdmin(interaction);

            expect(result).toBe(false);
            expect(interaction.memberPermissions?.has).toHaveBeenCalledWith(PermissionFlagsBits.Administrator);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Only admins can use this command.',
                flags: MessageFlags.Ephemeral,
            });
        });

        it('should return false when memberPermissions is null', async () => {
            const interaction = {
                memberPermissions: null,
                reply: vi.fn(),
            } as unknown as ChatInputCommandInteraction;

            const result = await requireAdmin(interaction);

            expect(result).toBe(false);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Only admins can use this command.',
                flags: MessageFlags.Ephemeral,
            });
        });
    });
});
