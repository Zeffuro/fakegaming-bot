import type { SupportedOutputLocale } from '../../../core/localization.js';

export interface NotesCopy {
    unknown: string;
    bodyRequired: string;
    saved: (id: string, title: string) => string;
    none: string;
    title: string;
    more: (count: number) => string;
    notFound: string;
    pinned: string;
    noBody: string;
    deleted: (id: string, title: string) => string;
    savedMessageTitle: string;
    emptyMessage: string;
    source: string;
    messageContains: (parts: string) => string;
    attachments: (count: number) => string;
    stickers: (count: number) => string;
    and: string;
    contextSaved: (id: string) => string;
    contextFailed: string;
}

const copies: Record<SupportedOutputLocale, NotesCopy> = {
    en: {
        unknown: 'Unknown notes subcommand.', bodyRequired: 'Add note text before saving.', saved: (id, title) => `Saved note \`${id}\`: ${title}`,
        none: 'You have no saved notes.', title: 'Your notes:', more: count => `\n...and ${count} more.`,
        notFound: 'Note not found. Use `/notes list` to see your notes.', pinned: 'pinned', noBody: '_No body_',
        deleted: (id, title) => `Deleted note \`${id}\`: ${title}`, savedMessageTitle: 'Saved message',
        emptyMessage: '[Message has no text content.]', source: 'Source', messageContains: parts => `[Message contains ${parts}; files were not downloaded.]`,
        attachments: count => `${count} attachment${count === 1 ? '' : 's'}`, stickers: count => `${count} sticker${count === 1 ? '' : 's'}`, and: 'and',
        contextSaved: id => `Saved this message to your private notes as \`${id}\`.`, contextFailed: 'I could not save that message to your private notes. Please try again later.',
    },
    nl: {
        unknown: 'Onbekende notitieopdracht.', bodyRequired: 'Voeg tekst toe voordat je de notitie opslaat.', saved: (id, title) => `Notitie \`${id}\` opgeslagen: ${title}`,
        none: 'Je hebt geen opgeslagen notities.', title: 'Je notities:', more: count => `\n...en nog ${count}.`,
        notFound: 'Notitie niet gevonden. Gebruik `/notities lijst` om je notities te bekijken.', pinned: 'vastgezet', noBody: '_Geen inhoud_',
        deleted: (id, title) => `Notitie \`${id}\` verwijderd: ${title}`, savedMessageTitle: 'Opgeslagen bericht',
        emptyMessage: '[Bericht bevat geen tekst.]', source: 'Bron', messageContains: parts => `[Bericht bevat ${parts}; bestanden zijn niet gedownload.]`,
        attachments: count => `${count} ${count === 1 ? 'bijlage' : 'bijlagen'}`, stickers: count => `${count} ${count === 1 ? 'sticker' : 'stickers'}`, and: 'en',
        contextSaved: id => `Dit bericht is als \`${id}\` opgeslagen in je privénotities.`, contextFailed: 'Ik kon dat bericht niet opslaan in je privénotities. Probeer het later opnieuw.',
    },
};

export function getNotesCopy(locale: SupportedOutputLocale): NotesCopy {
    return copies[locale];
}
