import {Client, ChannelType} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common';
import {loadPatchNoteFetchers} from '../loaders/loadPatchNoteFetchers.js';
import {PatchNotesManager} from "@zeffuro/fakegaming-common/dist/managers/patchNotesManager.js";
import {buildPatchNoteEmbed} from "../modules/patchnotes/shared/patchNoteEmbed.js";
import {PatchNoteConfig, PatchSubscriptionConfig} from "@zeffuro/fakegaming-common";

/**
 * Scans all games for new patch notes and updates them if newer.
 */
export async function scanAndUpdatePatchNotes(patchNotesManager: PatchNotesManager) {
    const fetchers = await loadPatchNoteFetchers();
    for (const fetcher of fetchers) {
        const latestStored = await patchNotesManager.getLatestPatch(fetcher.game);
        const latestPatch = await fetcher.fetchLatestPatchNote(latestStored?.version);
        if (latestPatch) {
            await patchNotesManager.setLatestPatch({
                ...latestPatch,
                game: fetcher.game
            });
        }
    }
}

/**
 * Announces new patch notes for all subscribed games in their respective Discord channels.
 */
export async function announceNewPatchNotes(client: Client): Promise<void> {
    const notes = await getConfigManager().patchNotesManager.getAllPlain() as PatchNoteConfig[];
    const subscriptions: PatchSubscriptionConfig[] = await getConfigManager().patchSubscriptionManager.getAllPlain() as PatchSubscriptionConfig[];

    for (const note of notes) {
        for (const sub of subscriptions.filter(s => s.game === note.game && s.guildId)) {
            if (!sub.lastAnnouncedAt || note.publishedAt > sub.lastAnnouncedAt) {
                const channel = client.channels.cache.get(sub.channelId);
                let guildId = sub.guildId;
                if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
                    // Only access channel.guild for guild channels
                    guildId = channel.guild?.id || sub.guildId;
                    const embed = buildPatchNoteEmbed(note);
                    await channel.send({embeds: [embed]});
                    sub.lastAnnouncedAt = note.publishedAt;
                    sub.guildId = guildId;
                    await getConfigManager().patchSubscriptionManager.upsertSubscription(sub);
                }
            }
        }
    }
}