import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, MessageFlags, AutocompleteInteraction } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { months } from '../../../constants/months.js';
import { requireAdmin } from '../../../utils/permissions.js';

const data = new SlashCommandBuilder()
    .setName('set-birthday')
    .setDescription('Set your birthday and the channel to post in')
    .addIntegerOption(option =>
        option.setName('day')
            .setDescription('Day of your birthday (1-31)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('month')
            .setDescription('Month of your birthday')
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addIntegerOption(option =>
        option.setName('year')
            .setDescription('Year of your birthday (optional)')
            .setRequired(false)
    )
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Channel to post your birthday message (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
    )
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to set birthday for (admins only)')
            .setRequired(false)
    );

function isValidDate(day: number, month: number, year?: number): boolean {
    const testYear = year ?? 2000;
    const date = new Date(testYear, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1;
}

async function execute(interaction: ChatInputCommandInteraction) {
    const day = interaction.options.getInteger('day', true);
    const monthName = interaction.options.getString('month', true);
    const year = interaction.options.getInteger('year', false) ?? undefined;
    const channel = interaction.options.getChannel('channel', false) ?? interaction.channel;
    const targetUser = interaction.options.getUser('user', false);
    const guildId = interaction.guildId!;

    let userId = interaction.user.id;
    if (targetUser) {
        if (!await requireAdmin(interaction)) return;
        userId = targetUser.id;
    }

    const monthObj = months.find(m => m.name.toLowerCase() === monthName.toLowerCase());
    if (!monthObj || !isValidDate(day, monthObj.value, year)) {
        await interaction.reply({ content: 'Invalid day or month.', flags: MessageFlags.Ephemeral });
        return;
    }

    const alreadySet = await getConfigManager().birthdayManager.hasBirthday(userId, guildId);
    if (alreadySet) {
        await interaction.reply({
            content: `${targetUser ? `<@${userId}>` : "You"} already have a birthday set in this channel.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await getConfigManager().birthdayManager.add({
        userId,
        day,
        month: monthObj.value,
        year,
        guildId,
        channelId: channel!.id
    });

    await interaction.reply({
        content: `${targetUser ? `<@${userId}>'s` : "Your"} birthday reminder is set!`,
        flags: MessageFlags.Ephemeral
    });
}

async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const choices = months
        .filter(m => m.name.toLowerCase().startsWith(focusedValue.toLowerCase()))
        .map(m => ({ name: m.name, value: m.name }));
    await interaction.respond(choices.slice(0, 25));
}

export default { data, execute, autocomplete, testOnly: false };
