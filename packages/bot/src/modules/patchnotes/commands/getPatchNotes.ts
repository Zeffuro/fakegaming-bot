import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction
} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {buildPatchNoteEmbed} from '../shared/patchNoteEmbed.js';
import {gameAutocomplete} from '../shared/gameAutocomplete.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { getPatchnotes as META } from '../commands.manifest.js';
import { fetchLatestPatchNoteApi, type LatestPatchNoteDto } from '../../../utils/apiClient.js';
import type { PatchNoteConfig } from '@zeffuro/fakegaming-common/models';
import type { CreationAttributes } from 'sequelize';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option => option.setName('game').setDescription('Game to get patch notes for').setRequired(true).setAutocomplete(true))
);

function toPatchNoteAttrs(dto: LatestPatchNoteDto): CreationAttributes<PatchNoteConfig> {
    const pa = dto.publishedAt as unknown;
    const publishedAt = pa instanceof Date ? pa : new Date(pa as string);

    const base: Partial<CreationAttributes<PatchNoteConfig>> = {
        game: dto.game,
        title: dto.title,
        content: dto.content,
        url: dto.url,
        publishedAt,
    };

    // Only set optional properties if provided; avoid adding nulls that break strict test equality
    if (dto.imageUrl !== undefined) (base as any).imageUrl = dto.imageUrl;
    if (dto.logoUrl !== undefined) (base as any).logoUrl = dto.logoUrl;
    if (dto.accentColor !== undefined) (base as any).accentColor = dto.accentColor as number | null;

    return base as CreationAttributes<PatchNoteConfig>;
}

async function execute(interaction: ChatInputCommandInteraction) {
    const game = interaction.options.getString('game', true);
    const latestPatch = await getConfigManager().patchNotesManager.getLatestPatch(game);

    if (latestPatch) {
        await interaction.reply({embeds: [buildPatchNoteEmbed(latestPatch)]});
    } else {
        const patch = await fetchLatestPatchNoteApi(game);
        if (patch) {
            const attrs = toPatchNoteAttrs(patch);
            await interaction.reply({embeds: [buildPatchNoteEmbed(attrs)]});
        } else {
            await interaction.reply(`No patch notes found for \`${game}\`.`);
        }
    }
}

async function autocomplete(interaction: AutocompleteInteraction) {
    await gameAutocomplete(interaction);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly, autocomplete};