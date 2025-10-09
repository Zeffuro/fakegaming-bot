import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
import { v4 as _uuidv4 } from 'uuid';

// Mock the uuid library
vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('mock-uuid-1234')
}));

describe('addQuote command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('adds a quote for a specified user', async () => {
        // Create mock for quote manager's upsertQuote method
        const quoteData = {
            id: 'mock-uuid-1234',
            guildId: '135381928284343204',
            quote: 'This is a test quote',
            authorId: '234567890123456789',
            submitterId: '123456789012345678',
            timestamp: expect.any(Number)
        };
        const addSpy = vi.fn().mockResolvedValue({ created: true, ...quoteData });

        // Create mock users
        const mockAuthor = {
            id: '234567890123456789',
            tag: 'testAuthor#1234'
        };

        const mockSubmitter = {
            id: '123456789012345678',
            tag: 'testSubmitter#1234'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/addQuote.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockImplementation(name => {
                            if (name === 'quote') return 'This is a test quote';
                            return null;
                        }),
                        getUser: vi.fn().mockImplementation(name => {
                            if (name === 'author') return mockAuthor;
                            return null;
                        })
                    },
                    user: mockSubmitter,
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    quoteManager: {
                        upsertQuote: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify quote manager's upsertQuote method was called with the correct parameters
        expect(addSpy).toHaveBeenCalledWith({
            id: 'mock-uuid-1234',
            guildId: '135381928284343204',
            quote: 'This is a test quote',
            authorId: '234567890123456789',
            submitterId: '123456789012345678',
            timestamp: expect.any(Number)
        });

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith(
            `Quote added for ${mockAuthor.tag}: "This is a test quote"`
        );
    });

    it('handles missing required parameters', async () => {
        // Setup the test environment with missing parameters
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/addQuote.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockImplementation(() => {
                            throw new Error('Required parameter missing');
                        }),
                        getUser: vi.fn().mockImplementation(() => {
                            throw new Error('Required parameter missing');
                        })
                    },
                    user: { id: '123456789012345678' },
                    guildId: '135381928284343204'
                }
            }
        );

        // Execute the command - it should throw an error
        await expect(
            command.execute(interaction as unknown as ChatInputCommandInteraction)
        ).rejects.toThrow('Required parameter missing');
    });
});
