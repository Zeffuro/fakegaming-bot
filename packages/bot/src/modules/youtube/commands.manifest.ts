// Static metadata for youtube module commands. No runtime deps.

export const addYoutubeChannel = { name: 'add-youtube-channel', description: 'Add a Youtube Channel for new video notifications', permissions: 'Administrator', localizations: { nl: { name: 'youtube-kanaal-toevoegen', description: 'Voeg een YouTube-kanaal toe voor nieuwe videomeldingen' } } } as const;
export const manageYoutubeChannels = { name: 'manage-youtube-channels', description: 'List, test, pause, resume, or remove YouTube video notifications', permissions: 'Administrator', localizations: { nl: { name: 'youtube-kanalen-beheren', description: 'Bekijk, test, pauzeer, hervat of verwijder YouTube-videomeldingen' } } } as const;
export const youtubeLatest = { name: 'youtube-latest', description: 'Show the latest video from a YouTube channel ID', localizations: { nl: { name: 'nieuwste-youtube-video', description: 'Toon de nieuwste video van een YouTube-kanaal-ID' } } } as const;

export const COMMANDS = [addYoutubeChannel, manageYoutubeChannels, youtubeLatest] as const;

// Mark as used for type/lint systems
void COMMANDS;
