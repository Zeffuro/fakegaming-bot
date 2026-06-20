import {MessageContextMenuCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {v4 as uuidv4} from 'uuid';
import {createMessageContextCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {remindMeInOneHour as META} from '../commands.manifest.js';

const data = createMessageContextCommand(META);
const oneHourMs = 60 * 60 * 1000;

function buildMessageLink(guildId: string, channelId: string, messageId: string): string {
    return `https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`;
}

async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({content: 'Message reminders only work in a server.', flags: MessageFlags.Ephemeral});
        return;
    }

    const targetMessage = interaction.targetMessage;
    const timestamp = Date.now() + oneHourMs;
    const messageLink = targetMessage.url || buildMessageLink(guildId, targetMessage.channelId, targetMessage.id);

    await getConfigManager().reminderManager.addReminder({
        id: uuidv4(),
        userId: interaction.user.id,
        message: `Follow up on this message: ${messageLink}`,
        timespan: '1h',
        timestamp,
    });

    await interaction.reply({
        content: `Reminder set for <t:${Math.floor(timestamp / 1000)}:R>.`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
