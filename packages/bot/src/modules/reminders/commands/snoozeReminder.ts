import {SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {parseTimespan} from '@zeffuro/fakegaming-common/utils';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {snoozeReminder as META} from '../commands.manifest.js';
import {shortReminderId} from '../shared/reminderFormat.js';
import {resolvePendingReminderForUser} from '../shared/reminderLookup.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option =>
            option
                .setName('reminder')
                .setDescription('Reminder number from /reminders or its short ID')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('timespan')
                .setDescription('How long to snooze for, e.g. 10m or 2h')
                .setRequired(true)
        )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const input = interaction.options.getString('reminder', true);
    const timespan = interaction.options.getString('timespan', true);
    const delayMs = parseTimespan(timespan);

    if (delayMs === null || delayMs <= 0) {
        await interaction.reply({content: 'Invalid timespan format. Use e.g. 10m, 1h, or 2d.', flags: MessageFlags.Ephemeral});
        return;
    }

    const reminder = await resolvePendingReminderForUser(interaction.user.id, input);

    if (!reminder) {
        await interaction.reply({content: 'Reminder not found. Use `/reminders` to see your pending reminders.', flags: MessageFlags.Ephemeral});
        return;
    }

    const timestamp = Date.now() + delayMs;
    await getConfigManager().reminderManager.updatePlain({timestamp, timespan} as any, {id: reminder.id} as any);
    await interaction.reply({
        content: `Snoozed reminder \`${shortReminderId(reminder.id)}\` until <t:${Math.floor(timestamp / 1000)}:F> (<t:${Math.floor(timestamp / 1000)}:R>).`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
