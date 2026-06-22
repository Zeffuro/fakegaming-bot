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

interface TestCommandOptions {
    auditRemove?: boolean;
    auditRemoveMetadata?: boolean;
    pause?: boolean;
    auditPause?: boolean;
    health?: boolean;
    healthMetadata?: boolean;
}

function createCommand(records: TestRecord[] = [], options: TestCommandOptions = {}) {
    const removeRecord = vi.fn(async (_id: number) => undefined);
    const setPausedRecord = vi.fn(async (_id: number, _paused: boolean) => undefined);
    const command = createIntegrationManagementCommand<TestRecord>({
        meta: {name: 'manage-test-integrations', description: 'Manage test integrations'},
        subjectSingular: 'test integration',
        subjectPlural: 'test integrations',
        listRecords: vi.fn(async (guildId) => records.filter((record) => record.guildId === guildId)),
        getRecord: vi.fn(async (id) => records.find((record) => record.id === id) ?? null),
        removeRecord,
        formatRecord: (record) => `${inlineCode(String(record.id))} ${inlineCode(record.name)} -> <#${record.discordChannelId}>`,
        describeRecord: (record) => `${inlineCode(record.name)} from <#${record.discordChannelId}>`,
        ...(options.auditRemove
            ? {
                auditRemove: {
                    action: 'test.delete',
                    targetType: 'testConfig',
                    ...(options.auditRemoveMetadata === false
                        ? {}
                        : {metadata: (record: TestRecord) => ({channelId: record.discordChannelId, name: record.name})}),
                },
            }
            : {}),
        ...(options.pause
            ? {
                setPausedRecord,
                ...(options.auditPause === false
                    ? {}
                    : {
                        auditPause: {
                            pauseAction: 'test.pause',
                            resumeAction: 'test.resume',
                            targetType: 'testConfig',
                            ...(options.healthMetadata === false
                                ? {}
                                : {metadata: (record: TestRecord, paused: boolean) => ({channelId: record.discordChannelId, name: record.name, paused})}),
                        },
                    }),
                ...(options.health === false
                    ? {}
                    : {
                        health: {
                            provider: 'test',
                            ...(options.healthMetadata === false
                                ? {}
                                : {metadata: (record: TestRecord, paused: boolean) => ({name: record.name, paused})}),
                        },
                    }),
            }
            : {}),
    });

    return {command, removeRecord, setPausedRecord};
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

    it('marks paused records in lists', async () => {
        const {command} = createCommand([
            {id: 1, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: true},
        ]);
        const interaction = createInteraction('list');

        await command.execute(interaction);

        expectReplyTextContains(interaction, '`1` `alpha` -> <#123456789012345678> paused');
    });

    it('shows when records exceed the visible record limit', async () => {
        const records = Array.from({length: 22}, (_, index) => ({
            id: index + 1,
            guildId: GUILD_ID,
            discordChannelId: CHANNEL_ID,
            name: `integration-${index + 1}`,
        }));
        const {command} = createCommand(records);
        const interaction = createInteraction('list');

        await command.execute(interaction);

        const content = (vi.mocked(interaction.reply).mock.calls[0]?.[0] as {content?: string}).content ?? '';
        expect(content).toContain('Configured test integrations:');
        expect(content).toContain('Showing first 20; 2 more not shown.');
    });

    it('truncates overlong list replies', async () => {
        const records = Array.from({length: 20}, (_, index) => ({
            id: index + 1,
            guildId: GUILD_ID,
            discordChannelId: CHANNEL_ID,
            name: `integration-${index + 1}-${'x'.repeat(120)}`,
        }));
        const {command} = createCommand(records);
        const interaction = createInteraction('list');

        await command.execute(interaction);

        const content = (vi.mocked(interaction.reply).mock.calls[0]?.[0] as {content?: string}).content ?? '';
        expect(content).toContain('Configured test integrations:');
        expect(content.endsWith('\n...truncated')).toBe(true);
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
        ], {auditRemove: true});
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

    it('removes a record without optional audit metadata', async () => {
        const auditRecord = vi.fn(async () => undefined);
        createMockConfigManager({
            auditEventManager: {record: auditRecord},
        });
        const {command, removeRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha'},
        ], {auditRemove: true, auditRemoveMetadata: false});
        const interaction = createInteraction('remove', 42);

        await command.execute(interaction);

        expect(removeRecord).toHaveBeenCalledWith(42);
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'test.delete',
            metadata: {
                source: 'discordCommand',
                commandName: 'manage-test-integrations',
                commandChannelId: '929533532185956352',
            },
        }));
    });

    it('pauses a record and records audit plus health status', async () => {
        const auditRecord = vi.fn(async () => undefined);
        const recordStatus = vi.fn(async () => undefined);
        createMockConfigManager({
            auditEventManager: {record: auditRecord},
            integrationHealthManager: {recordStatus},
        });
        const {command, setPausedRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: false},
        ], {pause: true});
        const interaction = createInteraction('pause', 42);

        await command.execute(interaction);

        expect(setPausedRecord).toHaveBeenCalledWith(42, true);
        expect(auditRecord).toHaveBeenCalledWith({
            actorId: '123456789012345678',
            actorType: 'user',
            action: 'test.pause',
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
                paused: true,
            },
        });
        expect(recordStatus).toHaveBeenCalledWith({
            provider: 'test',
            configId: 42,
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
            status: 'paused',
            metadata: {
                paused: true,
                name: 'alpha',
            },
        });
        expectEphemeralReply(interaction, {equals: 'Paused test integration `alpha` from <#123456789012345678>.'});
    });

    it('resumes a paused record and resets health status to unknown', async () => {
        const recordStatus = vi.fn(async () => undefined);
        createMockConfigManager({
            integrationHealthManager: {recordStatus},
        });
        const {command, setPausedRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: true},
        ], {pause: true});
        const interaction = createInteraction('resume', 42);

        await command.execute(interaction);

        expect(setPausedRecord).toHaveBeenCalledWith(42, false);
        expect(recordStatus).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'test',
            configId: 42,
            status: 'unknown',
            metadata: expect.objectContaining({paused: false, name: 'alpha'}),
        }));
        expectEphemeralReply(interaction, {equals: 'Resumed test integration `alpha` from <#123456789012345678>.'});
    });

    it('reports latest health for a configured record without provider calls', async () => {
        const getForConfig = vi.fn(async () => ({
            provider: 'test',
            configId: '42',
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
            status: 'error',
            lastCheckedAt: '2026-06-22T00:00:00.000Z',
            lastSuccessAt: null,
            lastFailureAt: '2026-06-22T00:01:00.000Z',
            lastDeliveryAt: '2026-06-21T23:59:00.000Z',
            consecutiveFailures: 3,
            lastErrorCode: 'RATE_LIMIT',
            lastErrorMessage: 'Too many requests',
            metadata: null,
        }));
        createMockConfigManager({
            integrationHealthManager: {getForConfig},
        });
        const {command} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: false},
        ], {pause: true});
        const interaction = createInteraction('test', 42);

        await command.execute(interaction);

        expect(getForConfig).toHaveBeenCalledWith('test', 42);
        expectReplyTextContains(interaction, 'Latest health for test integration `alpha` from <#123456789012345678>:');
        expectReplyTextContains(interaction, 'Status: `error`');
        expectReplyTextContains(interaction, 'Last checked: 2026-06-22T00:00:00.000Z');
        expectReplyTextContains(interaction, 'Consecutive failures: 3');
        expectReplyTextContains(interaction, 'Last error: `RATE_LIMIT` Too many requests');
    });

    it('reports when a configured record has no health history yet', async () => {
        const getForConfig = vi.fn(async () => null);
        createMockConfigManager({
            integrationHealthManager: {getForConfig},
        });
        const {command} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: false},
        ], {pause: true});
        const interaction = createInteraction('test', 42);

        await command.execute(interaction);

        expect(getForConfig).toHaveBeenCalledWith('test', 42);
        expectEphemeralReply(interaction, {
            equals: 'No health record has been recorded yet for test integration `alpha` from <#123456789012345678>. The next worker poll will populate it.',
        });
    });

    it('rejects health tests for commands without health support', async () => {
        const getForConfig = vi.fn(async () => null);
        createMockConfigManager({
            integrationHealthManager: {getForConfig},
        });
        const {command} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha'},
        ]);
        const interaction = createInteraction('test', 42);

        await command.execute(interaction);

        expect(getForConfig).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'That test integration does not have health checks configured.'});
    });

    it('pauses a record when audit and health are optional', async () => {
        const auditRecord = vi.fn(async () => undefined);
        const recordStatus = vi.fn(async () => undefined);
        createMockConfigManager({
            auditEventManager: {record: auditRecord},
            integrationHealthManager: {recordStatus},
        });
        const {command, setPausedRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: false},
        ], {pause: true, auditPause: false, health: false});
        const interaction = createInteraction('pause', 42);

        await command.execute(interaction);

        expect(setPausedRecord).toHaveBeenCalledWith(42, true);
        expect(auditRecord).not.toHaveBeenCalled();
        expect(recordStatus).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'Paused test integration `alpha` from <#123456789012345678>.'});
    });

    it('records pause audit and health without optional metadata callbacks', async () => {
        const auditRecord = vi.fn(async () => undefined);
        const recordStatus = vi.fn(async () => undefined);
        createMockConfigManager({
            auditEventManager: {record: auditRecord},
            integrationHealthManager: {recordStatus},
        });
        const {command} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: false},
        ], {pause: true, healthMetadata: false});
        const interaction = createInteraction('pause', 42);

        await command.execute(interaction);

        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'test.pause',
            metadata: {
                source: 'discordCommand',
                commandName: 'manage-test-integrations',
                commandChannelId: '929533532185956352',
            },
        }));
        expect(recordStatus).toHaveBeenCalledWith(expect.objectContaining({
            metadata: {paused: true},
        }));
    });

    it('continues when health status recording is unavailable or fails', async () => {
        createMockConfigManager({
            integrationHealthManager: {recordStatus: undefined as unknown as ReturnType<typeof vi.fn>},
        });
        const first = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: false},
        ], {pause: true, auditPause: false});
        const unavailableInteraction = createInteraction('pause', 42);

        await first.command.execute(unavailableInteraction);

        expect(first.setPausedRecord).toHaveBeenCalledWith(42, true);
        expectEphemeralReply(unavailableInteraction, {equals: 'Paused test integration `alpha` from <#123456789012345678>.'});

        const recordStatus = vi.fn(async () => {
            throw new Error('health failed');
        });
        createMockConfigManager({
            integrationHealthManager: {recordStatus},
        });
        const second = createCommand([
            {id: 43, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'beta', paused: false},
        ], {pause: true, auditPause: false});
        const failingInteraction = createInteraction('pause', 43);

        await second.command.execute(failingInteraction);

        expect(recordStatus).toHaveBeenCalledOnce();
        expectEphemeralReply(failingInteraction, {equals: 'Paused test integration `beta` from <#123456789012345678>.'});
    });

    it('does not pause a record that is already paused', async () => {
        const {command, setPausedRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: true},
        ], {pause: true});
        const interaction = createInteraction('pause', 42);

        await command.execute(interaction);

        expect(setPausedRecord).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'That test integration `alpha` from <#123456789012345678> is already paused.'});
    });

    it('does not resume a record that is already active', async () => {
        const {command, setPausedRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha', paused: false},
        ], {pause: true});
        const interaction = createInteraction('resume', 42);

        await command.execute(interaction);

        expect(setPausedRecord).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'That test integration `alpha` from <#123456789012345678> is already active.'});
    });

    it('rejects pause actions for commands without pause support', async () => {
        const {command, setPausedRecord} = createCommand([
            {id: 42, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, name: 'alpha'},
        ]);
        const interaction = createInteraction('pause', 42);

        await command.execute(interaction);

        expect(setPausedRecord).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'That test integration cannot be paused.'});
    });

    it('does not pause a record from another guild', async () => {
        const {command, setPausedRecord} = createCommand([
            {id: 42, guildId: 'other-guild', discordChannelId: CHANNEL_ID, name: 'alpha'},
        ], {pause: true});
        const interaction = createInteraction('pause', 42);

        await command.execute(interaction);

        expect(setPausedRecord).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'That test integration was not found in this server.'});
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

    it('reports unknown management actions', async () => {
        const {command} = createCommand();
        const interaction = createInteraction('unexpected');

        await command.execute(interaction);

        expectEphemeralReply(interaction, {equals: 'Unknown test integration management action.'});
    });
});
