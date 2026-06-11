import {ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {reminders as META} from '../commands.manifest.js';
import {formatReminderLine, type ReminderLike} from '../shared/reminderFormat.js';

const data = createSlashCommand(META);

async function execute(interaction: ChatInputCommandInteraction) {
    const rows = await getConfigManager().reminderManager.getRemindersByUser(interaction.user.id) as unknown as ReminderLike[];
    const pending = rows
        .filter(row => Number(row.timestamp) > Date.now())
        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

    if (pending.length === 0) {
        await interaction.reply({content: 'You have no pending reminders.', flags: MessageFlags.Ephemeral});
        return;
    }

    const lines = pending.slice(0, 10).map(formatReminderLine);
    const suffix = pending.length > 10 ? `\n...and ${pending.length - 10} more.` : '';
    await interaction.reply({
        content: `Your pending reminders:\n${lines.join('\n')}${suffix}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
