// Static metadata for tiktok module commands. No runtime deps.

export const addTikTokStream = { name: 'add-tiktok-stream', description: 'Add a TikTok account for live notifications', permissions: 'Administrator', localizations: { nl: { name: 'tiktok-stream-toevoegen', description: 'Voeg een TikTok-account toe voor livemeldingen' } } } as const;
export const manageTikTokStreams = { name: 'manage-tiktok-streams', description: 'List, test, pause, resume, or remove TikTok live notifications', permissions: 'Administrator', localizations: { nl: { name: 'tiktok-streams-beheren', description: 'Bekijk, test, pauzeer, hervat of verwijder TikTok-livemeldingen' } } } as const;

export const COMMANDS = [addTikTokStream, manageTikTokStreams] as const;

// Mark as used for type/lint systems
void COMMANDS;

