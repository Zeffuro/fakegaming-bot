import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
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
                .setNameLocalization('nl', 'lijst')
                .setDescription('List linked Riot accounts')
                .setDescriptionLocalization('nl', 'Toon gekoppelde Riot-accounts')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setNameLocalization('nl', 'tonen')
                .setDescription('Show a linked Riot account')
                .setDescriptionLocalization('nl', 'Toon een gekoppeld Riot-account')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setNameLocalization('nl', 'gebruiker')
                        .setDescription('Discord user')
                        .setDescriptionLocalization('nl', 'Discord-gebruiker')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlink')
                .setNameLocalization('nl', 'ontkoppelen')
                .setDescription('Remove a linked Riot account')
                .setDescriptionLocalization('nl', 'Verwijder een gekoppeld Riot-account')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setNameLocalization('nl', 'gebruiker')
                        .setDescription('Discord user')
                        .setDescriptionLocalization('nl', 'Discord-gebruiker')
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
            await interaction.editReply(leagueText(locale, { en: 'No Riot accounts are linked.', nl: 'Er zijn geen Riot-accounts gekoppeld.' }));
            return;
        }

        const lines = links.slice(0, 20).map(formatLink);
        const suffix = links.length > lines.length
            ? resolveLocaleValue(locale, { en: `\n...and ${links.length - lines.length} more.`, nl: `\n...en nog ${links.length - lines.length}.` })
            : '';
        await interaction.editReply(`${leagueText(locale, { en: 'Linked Riot accounts', nl: 'Gekoppelde Riot-accounts' })}:\n${lines.join('\n')}${suffix}`);
        return;
    }

    const user = interaction.options.getUser('user', true);

    if (subcommand === 'show') {
        const link = await manager.getLinkedAccountPlain(user.id) as LinkedRiotAccountPlain | null;
        if (!link) {
            await interaction.editReply(resolveLocaleValue(locale, { en: `No Riot account is linked for ${user}.`, nl: `Er is geen Riot-account gekoppeld voor ${user}.` }));
            return;
        }

        await interaction.editReply([
            resolveLocaleValue(locale, { en: `Linked Riot account for ${user}:`, nl: `Gekoppeld Riot-account voor ${user}:` }),
            `Riot ID: ${formatRiotId(link.riotIdGameName, link.riotIdTagLine, link.summonerName)}`,
            `${leagueText(locale, { en: 'Region', nl: 'Regio' })}: ${link.region}`,
            `PUUID: ${formatPuuid(link.puuid)}`,
        ].join('\n'));
        return;
    }

    if (subcommand === 'unlink') {
        const link = await manager.getLinkedAccountPlain(user.id) as LinkedRiotAccountPlain | null;
        if (!link) {
            await interaction.editReply(resolveLocaleValue(locale, { en: `No Riot account is linked for ${user}.`, nl: `Er is geen Riot-account gekoppeld voor ${user}.` }));
            return;
        }

        await manager.removeLinkedAccount(user.id);
        await interaction.editReply(resolveLocaleValue(locale, { en: `Removed linked Riot account for ${user}: ${formatRiotId(link.riotIdGameName, link.riotIdTagLine, link.summonerName)} [${link.region}]`, nl: `Gekoppeld Riot-account verwijderd voor ${user}: ${formatRiotId(link.riotIdGameName, link.riotIdTagLine, link.summonerName)} [${link.region}]` }));
        return;
    }

    await interaction.editReply(leagueText(locale, { en: 'Unknown Riot link action.', nl: 'Onbekende actie voor Riot-koppelingen.' }));
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly };
