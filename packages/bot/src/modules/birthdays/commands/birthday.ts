import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { formatBirthdayMonth, getBirthdayCopy } from '../copy/birthdayCopy.js';
import { birthday as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addUserOption(option =>
        option.setName('user')
            .setNameLocalization('nl', 'gebruiker')
            .setDescription('User to look up (optional)')
            .setDescriptionLocalization('nl', 'Gebruiker om op te zoeken (optioneel)')
            .setRequired(false)
    )
);

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getBirthdayCopy(locale);
    const targetUser = interaction.options.getUser('user', false);
    const userId = targetUser?.id ?? interaction.user.id;
    const guildId = interaction.guildId!;

    const birthday = await getConfigManager().birthdayManager.getBirthday(userId, guildId);
    if (!birthday) {
        await interaction.reply({
            content: locale === 'en'
                ? `${targetUser ? `<@${userId}>` : 'You'} do not have a birthday set in this channel.`
                : copy.notSet(targetUser ? `<@${userId}>` : copy.you),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const dateStr = `${birthday.day} ${formatBirthdayMonth(birthday.month, locale)}${birthday.year ? ` ${birthday.year}` : ''}`;
    await interaction.reply({
        content: copy.birthday(targetUser ? resolveLocaleValue(locale, { en: `<@${userId}>'s`, nl: `De` }) : copy.your, dateStr)
            .replace(/^De verjaardag/, `De verjaardag van <@${userId}>`),
        flags: MessageFlags.Ephemeral
    });
}

export default { data, execute, testOnly: getTestOnly(META) };
