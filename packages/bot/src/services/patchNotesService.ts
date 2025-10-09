import {Client, ChannelType, TextChannel} from 'discord.js';
import {getConfigManager, PatchNotesManager} from '@zeffuro/fakegaming-common/managers';
import {loadPatchNoteFetchers} from '../loaders/loadPatchNoteFetchers.js';
import {buildPatchNoteEmbed} from "../modules/patchnotes/shared/patchNoteEmbed.js";

/**
 * Helper to normalize timestamps to milliseconds for robust comparison
 */
const toMillis = (v: number | Date | null | undefined): number => {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    return 0;
};

/**
 * Scans all games for new patch notes and updates them if newer.
 */
export async function scanAndUpdatePatchNotes(patchNotesManager: PatchNotesManager) {
    const fetchers = await loadPatchNoteFetchers();

    for (const fetcher of fetchers) {
        const latestStored = await patchNotesManager.getLatestPatch(fetcher.game);
        const latestPatch = await fetcher.fetchLatestPatchNote(latestStored?.version);
        if (!latestPatch) continue;

        await patchNotesManager.setLatestPatch({
            ...latestPatch,
            game: fetcher.game
        });
    }
}

/**
 * Announces new patch notes for all subscribed games in their respective Discord channels.
 */
export async function announceNewPatchNotes(client: Client) {
    const notes = await getConfigManager().patchNotesManager.getAll({ raw: true });

    for (const note of notes) {
        const subscriptions = await getConfigManager()
            .patchSubscriptionManager.getSubscriptionsForGame(note.game);

        for (const sub of subscriptions) {
            const noteTime = toMillis(note.publishedAt);
            const subTime = toMillis(sub.lastAnnouncedAt);

            if (!subTime || noteTime > subTime) {
                const channel = client.channels.cache.get(sub.channelId) as TextChannel | undefined;
                if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
                    const embed = buildPatchNoteEmbed(note);
                    await channel.send({ embeds: [embed] });

                    // Update last announced
                    sub.lastAnnouncedAt = note.publishedAt;
                    await getConfigManager().patchSubscriptionManager.upsert(sub);
                }
            }
        }
    }
}