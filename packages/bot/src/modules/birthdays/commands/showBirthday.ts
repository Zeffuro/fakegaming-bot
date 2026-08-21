import { runtimeText } from '../../../core/runtimeCopy.js';
import {MessageFlags, UserContextMenuCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createUserContextCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {showBirthday as META} from '../commands.manifest.js';
import {resolveInteractionOutputLocale, type SupportedOutputLocale} from '../../../core/localization.js';
import {formatBirthdayMonth, getBirthdayCopy} from '../copy/birthdayCopy.js';

const data = createUserContextCommand(META);

function formatBirthday(day: number, month: number, locale: SupportedOutputLocale, year?: number | null): string {
    const monthName = formatBirthdayMonth(month, locale);
    return `${day} ${monthName}${year ? ` ${year}` : ''}`;
}

async function execute(interaction: UserContextMenuCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getBirthdayCopy(locale);
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({content: copy.serverOnly, flags: MessageFlags.Ephemeral});
        return;
    }

    const targetUser = interaction.targetUser;
    const birthday = await getConfigManager().birthdayManager.getBirthday(targetUser.id, guildId);
    if (!birthday) {
        await interaction.reply({
            content: copy.notSet(targetUser.tag),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        content: runtimeText(locale, 'birthdays', 'birthdayFor', {
            user: targetUser.tag, date: formatBirthday(birthday.day, birthday.month, locale, birthday.year),
        }),
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
