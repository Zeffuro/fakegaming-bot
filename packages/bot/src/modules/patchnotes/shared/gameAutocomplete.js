import { loadPatchNoteFetchers } from '../../../loaders/loadPatchNoteFetchers.js';
export async function gameAutocomplete(interaction) {
    const fetchers = await loadPatchNoteFetchers();
    const games = fetchers.map(f => f.game);
    const focused = interaction.options.getFocused();
    const filtered = games.filter(g => g.toLowerCase().includes(focused.toLowerCase()));
    await interaction.respond(filtered.map(g => ({ name: g, value: g })));
}
