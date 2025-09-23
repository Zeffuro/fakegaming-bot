import {Client, ChannelType} from 'discord.js';
import {configManager} from '../config/configManagerSingleton.js';
import {loadPatchNoteFetchers} from '../loaders/loadPatchNoteFetchers.js';
import {PatchNotesManager} from "../config/patchNotesManager.js";
import {buildPatchNoteEmbed} from "../modules/patchnotes/shared/patchNoteEmbed.js";

/**
 * Scans all games for new patch notes and updates them if newer.
 */
export async function scanAndUpdatePatchNotes(patchNotesManager: PatchNotesManager) {
    const fetchers = await loadPatchNoteFetchers();
    for (const fetcher of fetchers) {
        const latestStored = await patchNotesManager.getLatestPatch(fetcher.game);
        const latestPatch = await fetcher.fetchLatestPatchNote(latestStored?.version);
        if (latestPatch) {
            await patchNotesManager.setLatestPatch(latestPatch);
        }
    }
}

/**
 * Announces new patch notes for all subscribed games in their respective Discord channels.
 */
export async function announceNewPatchNotes(client: Client): Promise<void> {
    const notes = await configManager.patchNotesManager.getAll();
    const subscriptions = await configManager.patchSubscriptionManager.getAll();

    for (const note of notes) {
        for (const sub of subscriptions.filter(s => s.game === note.game)) {
            if (!sub.lastAnnouncedAt || note.publishedAt > sub.lastAnnouncedAt) {
                const channel = client.channels.cache.get(sub.channelId);
                if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
                    const embed = buildPatchNoteEmbed(note);
                    await channel.send({embeds: [embed]});
                    sub.lastAnnouncedAt = note.publishedAt;
                    await configManager.patchSubscriptionManager.setAll(subscriptions);
                }
            }
        }
    }
}