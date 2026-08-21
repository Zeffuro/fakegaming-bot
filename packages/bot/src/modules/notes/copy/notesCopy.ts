import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import englishMessages from '../../../messages/en/notes.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/notes.json' with { type: 'json' };

export interface NotesCopy {
    unknown: string; bodyRequired: string; saved: (id: string, title: string) => string; none: string; title: string;
    more: (count: number) => string; notFound: string; pinned: string; noBody: string;
    deleted: (id: string, title: string) => string; savedMessageTitle: string; emptyMessage: string; source: string;
    messageContains: (parts: string) => string; attachments: (count: number) => string; stickers: (count: number) => string;
    and: string; contextSaved: (id: string) => string; contextFailed: string;
}

export function getNotesCopy(locale: SupportedOutputLocale): NotesCopy {
    const messages = resolveLocaleValue(locale, { en: englishMessages, nl: dutchMessages } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    const raw = messages as typeof englishMessages;
    const t = createBotTranslator(locale, messages);
    return {
        unknown: raw.unknown, bodyRequired: raw.bodyRequired, none: raw.none, title: raw.title, notFound: raw.notFound,
        pinned: raw.pinned, noBody: raw.noBody, savedMessageTitle: raw.savedMessageTitle, emptyMessage: raw.emptyMessage,
        source: raw.source, and: raw.and, contextFailed: raw.contextFailed,
        saved: (id, title) => t('saved', { id, title }), more: count => t('more', { count }),
        deleted: (id, title) => t('deleted', { id, title }), messageContains: parts => t('messageContains', { parts }),
        attachments: count => t('attachments', { count }), stickers: count => t('stickers', { count }),
        contextSaved: id => t('contextSaved', { id }),
    };
}
