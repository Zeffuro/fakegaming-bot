import {Client, ChannelType, EmbedBuilder} from 'discord.js';
import {configManager} from '../config/configManagerSingleton.js';
import {loadPatchNoteFetchers} from '../loaders/loadPatchNoteFetchers.js';
import {PatchNotesManager} from "../config/patchNotesManager.js";
import {truncateDescription} from "../utils/generalUtils.js"

/**
 * Scans all games for new patch notes and updates them if newer.
 */
export async function scanAndUpdatePatchNotes(patchNotesManager: PatchNotesManager) {
    const fetchers = await loadPatchNoteFetchers();
    for (const fetcher of fetchers) {
        const latestStored = patchNotesManager.getLatestPatch(fetcher.game);
        const latestPatch = await fetcher.fetchLatestPatchNote(latestStored?.version);
        if (latestPatch) {
            await patchNotesManager.setLatestPatch(latestPatch);
        }
    }
}

/**
 * Announces new patch notes for all subscribed games in their respective Discord channels.
 * Builds a rich embed for each patch note, including accent color, logo, title, truncated content, and image.
 * Updates the last announced timestamp for each subscription after sending.
 *
 * @param {Client} client - The Discord client instance used to send messages.
 * @returns {Promise<void>} Resolves when all announcements are sent.
 */
export async function announceNewPatchNotes(client: Client) {
    const notes = configManager.patchNotesManager.getAll();
    const subscriptions = configManager.patchSubscriptionManager.getAll();

    for (const note of notes) {
        for (const sub of subscriptions.filter(s => s.game === note.game)) {
            if (!sub.lastAnnouncedAt || note.publishedAt > sub.lastAnnouncedAt) {
                const channel = client.channels.cache.get(sub.channelId);
                if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
                    const embed = new EmbedBuilder()
                        .setColor(note.accentColor ?? 0x5865F2)
                        .setTitle(note.title)
                        .setDescription(`${truncateDescription(note.content, 350)}`)
                        .setURL(note.url)
                        .setImage(note.imageUrl ?? null)
                        .setTimestamp(new Date(note.publishedAt))
                        .setFooter({text: new Date(note.publishedAt).toLocaleString()})
                        .setThumbnail(note.logoUrl ?? null)
                        .setAuthor({name: note.game});

                    await channel.send({embeds: [embed]});
                    sub.lastAnnouncedAt = note.publishedAt;
                    await configManager.patchSubscriptionManager.setAll(subscriptions);
                }
            }
        }
    }
}