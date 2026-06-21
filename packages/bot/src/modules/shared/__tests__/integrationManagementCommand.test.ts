import {ChatInputCommandInteraction} from 'discord.js';
import {describe, expect, it, vi} from 'vitest';
import {
    createMockCommandInteraction,
    createMockConfigManager,
    expectEphemeralReply,
    expectReplyTextContains,
} from '@zeffuro/fakegaming-common/testing';
import {
    createIntegrationManagementCommand,
    inlineCode,
    type IntegrationManagementRecord,
} from '../integrationManagementCommand.js';

const GUILD_ID = '987654321098765432';
const CHANNEL_ID = '123456789012345678';

interface TestRecord extends IntegrationManagementRecord {
    name: string;
}

function createCommand(records: TestRecord[] = [], auditRemove = false) {
    const removeRecord = vi.fn(async (_id: number) => undefined);
    const command = createIntegrationManagementCommand<TestRecord>({
        meta: {name: 'manage-test-integrations', description: 'Manage test integrations'},
        subjectSingular: 'test integration',
        subjectPlural: 'test integrations',
        listRecords: vi.fn(async (guildId) => records.filter((record) => record.guildId === guildId)),
        getRecord: vi.fn(async (id) => records.find((record) => record.id === id) ?? null),
        removeRecord,
        formatRecord: (record) => `${inlineCode(String(record.id))} ${inlineCode(record.name)} -> <#${record.discordChannelId}>`,
        describeRecord: (record) => `${inlineCode(record.name)} from <#${record.discordChannelId}>`,
        ...(auditRemove
            ? {
                auditRemove: {
                    action: 'test.delete',
                    targetType: 'testConfig',
                    metadata: (record: TestRecord) => ({channelId: record.discordChannelId, name: record.name}),
                },
            }
            : {}),
    });

    return {command, removeRecord};
}

function createInteraction(subcommand: string, id?: number, guildId: string | null = GUILD_ID) {
    return createMockCommandInteraction({
        guildId,
        commandName: 'manage-test-integrations',
        subcommand,
        integerOptions: id === undefined ? {} : {id},
        memberPermissions: {has: vi.fn(() => true)},
    }) as unknown as ChatInputCommandInteraction;
}

describe('integration management command factory', () => {
    it('lists configured records for the current guild', async () => {
        const {command} = createCommand([
            {id: 1, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha'},
            {id: 2, guildId: 'other-guild', discordChannelId: CHANNEL_ID, name: 'beta'},
        ]);
        const interaction = createInteraction('list');

        await command.execute(interaction);

        expectEphemeralReply(interaction, {contains: 'Configured test integrations:'});
        expectReplyTextContains(interaction, '`1` `alpha` -> <#123456789012345678>');
        const content = (vi.mocked(interaction.reply).mock.calls[0]?.[0] as {content?: string}).content ?? '';
        expect(content).not.toContain('beta');
    });

    it('replies clearly when no records are configured', async () => {
        const {command} = createCommand([]);
        const interaction = createInteraction('list');

        await command.execute(interaction);

        expectEphemeralReply(interaction, {equals: 'No test integrations are configured for this server.'});
    });

    it('removes a record by id when it belongs to the current guild', async () => {
        const auditRecord = vi.fn(async () => undefined);
        createMockConfigManager({
            auditEventManager: {record: auditRecord},
        });
        const {command, removeRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha'},
        ], true);
        const interaction = createInteraction('remove', 42);

        await command.execute(interaction);

        expect(removeRecord).toHaveBeenCalledWith(42);
        expect(auditRecord).toHaveBeenCalledWith({
            actorId: '123456789012345678',
            actorType: 'user',
            action: 'test.delete',
            targetType: 'testConfig',
            targetId: '42',
            guildId: GUILD_ID,
            severity: 'info',
            status: 'success',
            metadata: {
                source: 'discordCommand',
                commandName: 'manage-test-integrations',
                commandChannelId: '929533532185956352',
                channelId: CHANNEL_ID,
                name: 'alpha',
            },
        });
        expectEphemeralReply(interaction, {equals: 'Removed test integration `alpha` from <#123456789012345678>.'});
    });

    it('does not remove a record from another guild', async () => {
        const {command, removeRecord} = createCommand([
            {id: 42, guildId: 'other-guild', discordChannelId: CHANNEL_ID, name: 'alpha'},
        ]);
        const interaction = createInteraction('remove', 42);

        await command.execute(interaction);

        expect(removeRecord).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'That test integration was not found in this server.'});
    });

    it('rejects direct-message usage before manager access', async () => {
        const {command, removeRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha'},
        ]);
        const interaction = createInteraction('remove', 42, null);

        await command.execute(interaction);

        expect(removeRecord).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'This command can only be used in a server.'});
    });
});
