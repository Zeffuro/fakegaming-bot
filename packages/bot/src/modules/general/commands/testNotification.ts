import {SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, MessageFlags, TextBasedChannel} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';
import {getGeneralCopy} from '../data/generalCopy.js';
import {requireAdmin} from '../../../utils/permissions.js';
import {testNotification as META} from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addChannelOption(option =>
            option
                .setName('channel')
                .setNameLocalization('nl', 'kanaal')
                .setDescription('Channel to send the test notification to')
                .setDescriptionLocalization('nl', 'Kanaal waar de testmelding naartoe wordt gestuurd')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setNameLocalization('nl', 'bericht')
                .setDescription('Optional custom test message')
                .setDescriptionLocalization('nl', 'Optioneel aangepast testbericht')
                .setRequired(false)
        )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const copy = getGeneralCopy(await resolveInteractionOutputLocale(interaction));
    if (!await requireAdmin(interaction)) return;

    const selected = interaction.options.getChannel('channel') as TextBasedChannel | null;
    const target = selected ?? interaction.channel;
    if (!target || !('send' in target)) {
        await interaction.reply({content: copy.testNotification.cannotSend, flags: MessageFlags.Ephemeral});
        return;
    }

    const message = interaction.options.getString('message') ?? copy.testNotification.defaultMessage;
    await target.send({
        content: message,
        embeds: [{
            title: copy.testNotification.title,
            description: copy.testNotification.description,
            color: 0x68D7FF,
            timestamp: new Date().toISOString(),
        }],
    });

    await interaction.reply({content: copy.testNotification.sent(String(target)), flags: MessageFlags.Ephemeral});
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
