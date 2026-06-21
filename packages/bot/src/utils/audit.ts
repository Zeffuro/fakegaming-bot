import type {ChatInputCommandInteraction} from 'discord.js';
import {
    getLogger,
    type AuditEventSeverity,
    type AuditEventStatus,
} from '@zeffuro/fakegaming-common';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {sanitizeAuditMetadata} from '@zeffuro/fakegaming-common/utils';

const log = getLogger({name: 'bot:audit'});

export interface BotAuditEventParams {
    action: string;
    targetType: string;
    targetId?: string | number | null;
    guildId?: string | null;
    severity?: AuditEventSeverity;
    status?: AuditEventStatus;
    metadata?: Record<string, unknown> | null;
}

/**
 * Records a Discord command audit event without allowing audit persistence failures to break the command.
 */
export async function recordBotAuditEvent(
    interaction: ChatInputCommandInteraction,
    params: BotAuditEventParams
): Promise<void> {
    try {
        await getConfigManager().auditEventManager.record({
            actorId: interaction.user.id,
            actorType: 'user',
            action: params.action,
            targetType: params.targetType,
            targetId: params.targetId === undefined || params.targetId === null ? null : String(params.targetId),
            guildId: params.guildId ?? interaction.guildId ?? null,
            severity: params.severity ?? 'info',
            status: params.status ?? 'success',
            metadata: sanitizeAuditMetadata({
                source: 'discordCommand',
                commandName: interaction.commandName,
                commandChannelId: interaction.channelId,
                ...params.metadata,
            }),
        });
    } catch (err) {
        log.warn({
            err,
            action: params.action,
            targetType: params.targetType,
            status: params.status ?? 'success',
        }, 'Failed to persist bot audit event');
    }
}
