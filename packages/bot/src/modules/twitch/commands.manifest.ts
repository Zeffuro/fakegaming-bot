// Static metadata for twitch module commands. No runtime deps.

export const addTwitchStream = { name: 'add-twitch-stream', description: 'Add a Twitch stream for notifications', permissions: 'Administrator', localizations: { nl: { name: 'twitch-stream-toevoegen', description: 'Voeg een Twitch-stream toe voor meldingen' } } } as const;
export const manageTwitchStreams = { name: 'manage-twitch-streams', description: 'List, test, pause, resume, or remove Twitch stream notifications', permissions: 'Administrator', localizations: { nl: { name: 'twitch-streams-beheren', description: 'Bekijk, test, pauzeer, hervat of verwijder Twitch-streammeldingen' } } } as const;
export const streamStatus = { name: 'stream-status', description: 'Check whether a Twitch channel is live', localizations: { nl: { name: 'streamstatus', description: 'Controleer of een Twitch-kanaal live is' } } } as const;
export const twitchLatestVod = { name: 'twitch-latest-vod', description: 'Show the latest Twitch archive VOD for a channel', localizations: { nl: { name: 'nieuwste-twitch-vod', description: 'Toon de nieuwste Twitch-archief-VOD van een kanaal' } } } as const;

export const COMMANDS = [addTwitchStream, manageTwitchStreams, streamStatus, twitchLatestVod] as const;

// Mark as used for type/lint systems
void COMMANDS;
