import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { requireAdmin } from '../../../utils/permissions.js';
import { riotLinks as META } from '../commands.manifest.js';

interface LinkedRiotAccountPlain {
    discordId: string;
    summonerName: string;
    region: string;
    puuid: string;
}

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List linked Riot accounts')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show a linked Riot account')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Discord user')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlink')
                .setDescription('Remove a linked Riot account')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Discord user')
                        .setRequired(true)
                )
        )
);

function formatLink(link: LinkedRiotAccountPlain): string {
    return `<@${link.discordId}>: ${link.summonerName} [${link.region}]`;
}

function formatPuuid(puuid: string): string {
    if (puuid.length <= 16) return puuid;
    return `${puuid.slice(0, 8)}...${puuid.slice(-8)}`;
}

async function execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand(true);
    const manager = getConfigManager().leagueManager;

    if (subcommand === 'list') {
        const links = await manager.getLinkedAccountsPlain() as LinkedRiotAccountPlain[];
        if (links.length === 0) {
            await interaction.editReply('No Riot accounts are linked.');
            return;
        }

        const lines = links.slice(0, 20).map(formatLink);
        const suffix = links.length > lines.length ? `\n...and ${links.length - lines.length} more.` : '';
        await interaction.editReply(`Linked Riot accounts:\n${lines.join('\n')}${suffix}`);
        return;
    }

    const user = interaction.options.getUser('user', true);

    if (subcommand === 'show') {
        const link = await manager.getLinkedAccountPlain(user.id) as LinkedRiotAccountPlain | null;
        if (!link) {
            await interaction.editReply(`No Riot account is linked for ${user}.`);
            return;
        }

        await interaction.editReply([
            `Linked Riot account for ${user}:`,
            `Riot ID: ${link.summonerName}`,
            `Region: ${link.region}`,
            `PUUID: ${formatPuuid(link.puuid)}`,
        ].join('\n'));
        return;
    }

    if (subcommand === 'unlink') {
        const link = await manager.getLinkedAccountPlain(user.id) as LinkedRiotAccountPlain | null;
        if (!link) {
            await interaction.editReply(`No Riot account is linked for ${user}.`);
            return;
        }

        await manager.removeLinkedAccount(user.id);
        await interaction.editReply(`Removed linked Riot account for ${user}: ${link.summonerName} [${link.region}]`);
        return;
    }

    await interaction.editReply('Unknown Riot link action.');
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
