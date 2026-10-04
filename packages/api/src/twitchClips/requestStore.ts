import { Op, UniqueConstraintError } from 'sequelize';
import { getSequelize } from '@zeffuro/fakegaming-common';
import { TwitchClipConfig, TwitchClipCooldown, TwitchClipRequest } from '@zeffuro/fakegaming-common/models';
import type { TwitchClipChatMessage } from './chatMessage.js';

export async function reserveTwitchClipRequest(
    message: TwitchClipChatMessage,
    configs: TwitchClipConfig[],
    now = new Date(),
): Promise<TwitchClipRequest | null> {
    if (configs.length === 0) return null;
    try {
        return await getSequelize().transaction(async transaction => {
            await TwitchClipCooldown.findOrCreate({
                where: { broadcasterId: message.broadcaster_user_id },
                defaults: { broadcasterId: message.broadcaster_user_id, availableAt: new Date(0) },
                transaction,
            });
            const cooldownSeconds = Math.max(...configs.map(config => config.cooldownSeconds));
            const [claimed] = await TwitchClipCooldown.update({
                availableAt: new Date(now.getTime() + cooldownSeconds * 1000),
            }, { where: { broadcasterId: message.broadcaster_user_id, availableAt: { [Op.lte]: now } }, transaction });
            if (claimed !== 1) return null;
            // Persist the claim before Twitch's non-idempotent create call.
            return TwitchClipRequest.create({
                id: message.message_id,
                broadcasterId: message.broadcaster_user_id,
                status: 'creating',
                clipId: null,
                targetsJson: JSON.stringify(configs.map(config => config.id)),
                triggerName: message.chatter_user_name,
                requestedAt: now,
                errorCode: null,
            }, { transaction });
        });
    } catch (error) {
        if (error instanceof UniqueConstraintError) return null;
        throw error;
    }
}

export async function recoverTwitchClipRequests(now = new Date()): Promise<TwitchClipRequest[]> {
    // A crash during creation has an unknown outcome; never create a second clip for it.
    await TwitchClipRequest.update({ status: 'failed', errorCode: 'creation_interrupted' }, {
        where: { status: 'creating', requestedAt: { [Op.lt]: new Date(now.getTime() - 2 * 60_000) } },
    });
    await TwitchClipRequest.destroy({
        where: {
            status: { [Op.in]: ['failed', 'delivered'] },
            requestedAt: { [Op.lt]: new Date(now.getTime() - 7 * 24 * 60 * 60_000) },
        },
    });
    return TwitchClipRequest.findAll({ where: { status: 'ready' }, order: [['requestedAt', 'ASC']], limit: 100 });
}

export async function getTwitchClipTargets(request: TwitchClipRequest): Promise<TwitchClipConfig[]> {
    const ids: unknown = JSON.parse(request.targetsJson);
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) throw new Error('Invalid Twitch clip destinations');
    return TwitchClipConfig.findAll({
        where: { id: { [Op.in]: ids }, broadcasterId: request.broadcasterId, enabled: true },
    });
}
