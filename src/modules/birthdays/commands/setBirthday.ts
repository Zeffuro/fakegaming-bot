import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    MessageFlags,
    User,
    AutocompleteInteraction
} from 'discord.js';
import {configManager} from '../../../config/configManagerSingleton.js';
import {months} from "../../../constants/months.js";
import {requireAdmin} from "../../../utils/permissions.js";

export const data = new SlashCommandBuilder()
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
    ).addUserOption(option =>
        option.setName('user')
            .setDescription('Set birthday for another user (admins only)')
            .setRequired(false)
    );

export const testOnly = false;

export async function execute(interaction: ChatInputCommandInteraction) {
    const day = interaction.options.getInteger('day', true);
    const monthName = interaction.options.getString('month', true);
    const year = interaction.options.getInteger('year', false) ?? undefined;
    const channel = interaction.options.getChannel('channel', false) ?? interaction.channel;
    const targetUser = interaction.options.getUser('user', false);
    const guildId = interaction.guildId ?? "";

    let userId: string = interaction.user.id;
    if (targetUser) {
        if (!await requireAdmin(interaction)) return;
        userId = targetUser.id;
    }

    const monthObj = months.find(month => month.name.toLowerCase() === monthName.toLowerCase());
    if (!monthObj || day < 1 || day > 31) {
        await interaction.reply({content: 'Invalid day or month.', flags: MessageFlags.Ephemeral});
        return;
    }

    if (!channel) {
        await interaction.reply({
            content: 'Could not determine a channel to set the birthday in.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const alreadySet = await configManager.birthdayManager.hasBirthday({
        userId,
        guildId: guildId,
    });

    if (alreadySet) {
        await interaction.reply({
            content: `${targetUser ? `<@${targetUser.id}>` : "You"} already have a birthday set in this channel.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await configManager.birthdayManager.add({
        userId: userId,
        day,
        month: monthObj.value,
        year,
        guildId: guildId,
        channelId: channel.id,
    });

    await interaction.reply({
        content: getBirthdayResponse(targetUser, day, monthObj.value, year),
        flags: MessageFlags.Ephemeral
    });
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const choices = months
        .filter(month => month.name.toLowerCase().startsWith(focusedValue.toLowerCase()))
        .map(month => ({name: month.name, value: month.name}));
    await interaction.respond(choices.slice(0, 25));
}

function getBirthdayResponse(targetUser: User | null, day: number, month: number, year?: number): string {
    const now = new Date();
    let nextBirthday = new Date(now.getFullYear(), month - 1, day);

    // If today is the birthday, don't increment the year
    if (
        nextBirthday.getDate() === now.getDate() &&
        nextBirthday.getMonth() === now.getMonth()
    ) {
        // today is birthday
    } else if (nextBirthday < now) {
        nextBirthday.setFullYear(now.getFullYear() + 1);
    }

    const daysUntil = Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const age = year ? nextBirthday.getFullYear() - year : undefined;
    const formattedDate = `${nextBirthday.getDate()} ${months[month - 1].name} ${nextBirthday.getFullYear()}`;

    return `${targetUser ? `<@${targetUser.id}>'s` : "Your"} birthday reminder is set!${age ? ` Turning ${age} soon` : ""}. Only ${daysUntil === 0 ? "today" : `${daysUntil} days left until ${formattedDate}`} 🎉`;
}