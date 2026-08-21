import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { formatBirthdayMonth, getBirthdayCopy } from '../copy/birthdayCopy.js';
import { birthday as META } from '../commands.manifest.js';
import { runtimeText } from '../../../core/runtimeCopy.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addUserOption(option =>
        option.setName('user')
            .setDescription('User to look up (optional)')
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
            content: runtimeText(locale, 'birthdays', 'notSetInChannel', {
                subject: targetUser ? `<@${userId}>` : copy.you,
                kind: targetUser ? 'other' : 'self',
            }),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const dateStr = `${birthday.day} ${formatBirthdayMonth(birthday.month, locale)}${birthday.year ? ` ${birthday.year}` : ''}`;
    await interaction.reply({
        content: targetUser
            ? runtimeText(locale, 'birthdays', 'birthdayFor', {user: `<@${userId}>`, date: dateStr})
            : copy.birthday(copy.your, dateStr),
        flags: MessageFlags.Ephemeral
    });
}

export default { data, execute, testOnly: getTestOnly(META) };
