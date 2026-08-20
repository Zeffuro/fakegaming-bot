import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, MessageFlags, AutocompleteInteraction } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { months } from '../../../constants/months.js';
import { requireAdmin } from '../../../utils/permissions.js';
import { subjectForUser, subjectNominative } from '../shared/messages.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { setBirthday as META } from '../commands.manifest.js';
import { UniqueConstraintError } from 'sequelize';
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { formatBirthdayMonth, getBirthdayCopy } from '../copy/birthdayCopy.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addIntegerOption(option =>
            option.setName('day')
                .setNameLocalization('nl', 'dag')
                .setDescription('Day of your birthday (1-31)')
                .setDescriptionLocalization('nl', 'Dag van je verjaardag (1-31)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('month')
                .setNameLocalization('nl', 'maand')
                .setDescription('Month of your birthday')
                .setDescriptionLocalization('nl', 'Maand van je verjaardag')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('year')
                .setNameLocalization('nl', 'jaar')
                .setDescription('Year of your birthday (optional)')
                .setDescriptionLocalization('nl', 'Geboortejaar (optioneel)')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setNameLocalization('nl', 'kanaal')
                .setDescription('Channel to post your birthday message (defaults to current channel)')
                .setDescriptionLocalization('nl', 'Kanaal voor de verjaardagsmelding (standaard het huidige kanaal)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user')
                .setNameLocalization('nl', 'gebruiker')
                .setDescription('User to set birthday for (admins only)')
                .setDescriptionLocalization('nl', 'Gebruiker voor wie je de verjaardag instelt (alleen beheerders)')
                .setRequired(false)
        )
);

function isValidDate(day: number, month: number, year?: number): boolean {
    const testYear = year ?? 2000;
    const date = new Date(testYear, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1;
}

async function replyAlreadySet(interaction: ChatInputCommandInteraction, targetUserId: string | null, locale: SupportedOutputLocale) {
    const copy = getBirthdayCopy(locale);
    await interaction.reply({
        content: copy.alreadySet(subjectNominative(targetUserId, locale)),
        flags: MessageFlags.Ephemeral
    });
}

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getBirthdayCopy(locale);
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

    const monthObj = months.find(m => m.name.toLowerCase() === monthName.toLowerCase()
        || formatBirthdayMonth(m.value, locale).toLowerCase() === monthName.toLowerCase());
    if (!monthObj || !isValidDate(day, monthObj.value, year)) {
        await interaction.reply({ content: copy.invalidDate, flags: MessageFlags.Ephemeral });
        return;
    }

    const alreadySet = await getConfigManager().birthdayManager.hasBirthday(userId, guildId);
    if (alreadySet) {
        await replyAlreadySet(interaction, targetUser ? userId : null, locale);
        return;
    }

    try {
        await getConfigManager().birthdayManager.add({
            userId,
            day,
            month: monthObj.value,
            year,
            guildId,
            channelId: channel!.id
        });
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            await replyAlreadySet(interaction, targetUser ? userId : null, locale);
            return;
        }
        throw error;
    }

    await interaction.reply({
        content: copy.reminderSet(subjectForUser(targetUser ? userId : null, locale)),
        flags: MessageFlags.Ephemeral
    });
}

async function autocomplete(interaction: AutocompleteInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const focusedValue = interaction.options.getFocused();
    const choices = months
        .map(m => ({ name: formatBirthdayMonth(m.value, locale), value: m.name }))
        .filter(m => m.name.toLowerCase().startsWith(focusedValue.toLowerCase()));
    await interaction.respond(choices.slice(0, 25));
}

export default { data, execute, autocomplete, testOnly: getTestOnly(META) };
