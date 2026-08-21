import { runtimeText } from '../../../core/runtimeCopy.js';
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { formatRiotId } from '@zeffuro/fakegaming-common/utils';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { requireAdmin } from '../../../utils/permissions.js';
import { riotLinks as META } from '../commands.manifest.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { leagueText } from '../copy/leagueCopy.js';

interface LinkedRiotAccountPlain {
    discordId: string;
    summonerName: string;
    riotIdGameName?: string | null;
    riotIdTagLine?: string | null;
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
    return `<@${link.discordId}>: ${formatRiotId(link.riotIdGameName, link.riotIdTagLine, link.summonerName)} [${link.region}]`;
}

function formatPuuid(puuid: string): string {
    if (puuid.length <= 16) return puuid;
    return `${puuid.slice(0, 8)}...${puuid.slice(-8)}`;
}

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand(true);
    const manager = getConfigManager().leagueManager;

    if (subcommand === 'list') {
        const links = await manager.getLinkedAccountsPlain() as LinkedRiotAccountPlain[];
        if (links.length === 0) {
            await interaction.editReply(leagueText(locale, "noRiotAccountsAreLinked"));
            return;
        }

        const lines = links.slice(0, 20).map(formatLink);
        const suffix = links.length > lines.length
            ? runtimeText(locale, 'league', 'andMore', {count: links.length - lines.length})
            : '';
        await interaction.editReply(`${leagueText(locale, "linkedRiotAccounts")}:\n${lines.join('\n')}${suffix}`);
        return;
    }

    const user = interaction.options.getUser('user', true);

    if (subcommand === 'show') {
        const link = await manager.getLinkedAccountPlain(user.id) as LinkedRiotAccountPlain | null;
        if (!link) {
            await interaction.editReply(runtimeText(locale, 'league', 'noRiotAccountIsLinkedFor', {user: user.toString()}));
            return;
        }

        await interaction.editReply([
            runtimeText(locale, 'league', 'linkedRiotAccountFor', {user: user.toString()}),
            `Riot ID: ${formatRiotId(link.riotIdGameName, link.riotIdTagLine, link.summonerName)}`,
            `${leagueText(locale, "region")}: ${link.region}`,
            `PUUID: ${formatPuuid(link.puuid)}`,
        ].join('\n'));
        return;
    }

    if (subcommand === 'unlink') {
        const link = await manager.getLinkedAccountPlain(user.id) as LinkedRiotAccountPlain | null;
        if (!link) {
            await interaction.editReply(runtimeText(locale, 'league', 'noRiotAccountIsLinkedFor', {user: user.toString()}));
            return;
        }

        await manager.removeLinkedAccount(user.id);
        await interaction.editReply(runtimeText(locale, 'league', 'removedLinkedRiotAccountFor', {
            user: user.toString(), riotId: formatRiotId(link.riotIdGameName, link.riotIdTagLine, link.summonerName), region: link.region,
        }));
        return;
    }

    await interaction.editReply(leagueText(locale, "unknownRiotLinkAction"));
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
