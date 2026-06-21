import type {ChatInputCommandInteraction} from 'discord.js';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
    createMockCommandInteraction,
    createMockConfigManager,
    expectEphemeralReply,
    expectReplyText,
} from '@zeffuro/fakegaming-common/testing';
import {createSubscriptionCommand} from '../createSubscriptionCommand.js';
import {requireAdmin} from '../../utils/permissions.js';

vi.mock('../../utils/permissions.js', () => ({
    requireAdmin: vi.fn(),
}));

const GUILD_ID = '987654321098765432';
const COMMAND_CHANNEL_ID = '929533532185956352';
const TARGET_CHANNEL_ID = '123456789012345678';

function createInteraction(username = 'creator'): ChatInputCommandInteraction {
    return createMockCommandInteraction({
        commandName: 'add-test-subscription',
        guildId: GUILD_ID,
        channelId: COMMAND_CHANNEL_ID,
        stringOptions: {username},
        channelOptions: {channel: TARGET_CHANNEL_ID},
    }) as unknown as ChatInputCommandInteraction;
}

describe('createSubscriptionCommand', () => {
    beforeEach(() => {
        vi.mocked(requireAdmin).mockResolvedValue(true);
    });

    it('records an audit event after adding a subscription', async () => {
        const auditRecord = vi.fn(async () => undefined);
        createMockConfigManager({
            auditEventManager: {record: auditRecord},
        });
        const addSubscription = vi.fn(async () => undefined);
        const command = createSubscriptionCommand<string>({
            meta: {name: 'add-test-subscription', description: 'Add a test subscription'},
            usernameOptionDescription: 'Test username',
            resolveOrVerify: async (username) => ({ok: true, id: `external-${username}`}),
            addSubscription,
            auditAdd: {
                action: 'test.create',
                targetType: 'testConfig',
                targetId: ({externalId}) => externalId,
                metadata: ({username, externalId, discordChannelId}) => ({
                    channelId: discordChannelId,
                    username,
                    externalId,
                }),
            },
            successMessage: ({username, channelId}) => `Added ${username} in <#${channelId}>.`,
            alreadyConfiguredMessage: ({username}) => `${username} already exists.`,
            notFoundMessage: ({username}) => `${username} not found.`,
        });
        const interaction = createInteraction();

        await command.execute(interaction);

        expect(addSubscription).toHaveBeenCalledWith({
            username: 'creator',
            externalId: 'external-creator',
            discordChannelId: TARGET_CHANNEL_ID,
            guildId: GUILD_ID,
            customMessage: undefined,
        });
        expect(auditRecord).toHaveBeenCalledWith({
            actorId: '123456789012345678',
            actorType: 'user',
            action: 'test.create',
            targetType: 'testConfig',
            targetId: 'external-creator',
            guildId: GUILD_ID,
            severity: 'info',
            status: 'success',
            metadata: {
                source: 'discordCommand',
                commandName: 'add-test-subscription',
                commandChannelId: COMMAND_CHANNEL_ID,
                channelId: TARGET_CHANNEL_ID,
                username: 'creator',
                externalId: 'external-creator',
            },
        });
        expectReplyText(interaction, `Added creator in <#${TARGET_CHANNEL_ID}>.`);
    });

    it('does not record an audit event when the subscription already exists', async () => {
        const auditRecord = vi.fn(async () => undefined);
        createMockConfigManager({
            auditEventManager: {record: auditRecord},
        });
        const addSubscription = vi.fn(async () => undefined);
        const command = createSubscriptionCommand<string>({
            meta: {name: 'add-test-subscription', description: 'Add a test subscription'},
            usernameOptionDescription: 'Test username',
            resolveOrVerify: async (username) => ({ok: true, id: `external-${username}`}),
            checkExistingPre: async () => true,
            addSubscription,
            auditAdd: {
                action: 'test.create',
                targetType: 'testConfig',
                targetId: ({externalId}) => externalId,
            },
            successMessage: ({username, channelId}) => `Added ${username} in <#${channelId}>.`,
            alreadyConfiguredMessage: ({username}) => `${username} already exists.`,
            notFoundMessage: ({username}) => `${username} not found.`,
        });
        const interaction = createInteraction();

        await command.execute(interaction);

        expect(addSubscription).not.toHaveBeenCalled();
        expect(auditRecord).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'creator already exists.'});
    });
});
