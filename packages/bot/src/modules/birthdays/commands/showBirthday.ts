import {MessageFlags, UserContextMenuCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {createUserContextCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {months} from '../../../constants/months.js';
import {showBirthday as META} from '../commands.manifest.js';

const data = createUserContextCommand(META);

function formatBirthday(day: number, month: number, year?: number | null): string {
    const monthName = months[month - 1]?.name ?? String(month);
    return `${day} ${monthName}${year ? ` ${year}` : ''}`;
}

async function execute(interaction: UserContextMenuCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({content: 'Birthday lookup only works in a server.', flags: MessageFlags.Ephemeral});
        return;
    }

    const targetUser = interaction.targetUser;
    const birthday = await getConfigManager().birthdayManager.getBirthday(targetUser.id, guildId);
    if (!birthday) {
        await interaction.reply({
            content: `${targetUser.tag} does not have a birthday set in this server.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        content: `${targetUser.tag}'s birthday: ${formatBirthday(birthday.day, birthday.month, birthday.year)}`,
        flags: MessageFlags.Ephemeral,
    });
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, description: META.description, execute, testOnly};
