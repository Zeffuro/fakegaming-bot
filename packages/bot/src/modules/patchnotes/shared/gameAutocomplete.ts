import {AutocompleteInteraction} from 'discord.js';
import { getDefaultPatchNoteFetchers } from '@zeffuro/fakegaming-common';

export async function gameAutocomplete(interaction: AutocompleteInteraction) {
    const fetchers = await getDefaultPatchNoteFetchers();
    const games = fetchers.map(f => f.game);
    const focused = interaction.options.getFocused();
    const filtered = games.filter(g => g.toLowerCase().includes(focused.toLowerCase()));
    await interaction.respond(filtered.map(g => ({name: g, value: g})));
}