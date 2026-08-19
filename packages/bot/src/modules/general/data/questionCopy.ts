import { createLocaleCatalog } from '../../../core/localization.js';
import type { QuestionCategorySelection } from '../shared/questionDeck.js';

const _QUESTION_COPY_KEYS = [
    'title',
    'anotherQuestion',
    'categoryUnavailable',
    'questionsUnavailable',
    'buttonUnavailable',
    'categoryFooter',
    'category.any',
    'category.gaming',
    'category.silly',
    'category.would-you-rather',
    'category.getting-to-know-you',
    'category.deep',
] as const;

export type QuestionCopyKey = typeof _QUESTION_COPY_KEYS[number];

export const QUESTION_COPY = createLocaleCatalog<QuestionCopyKey>({
    title: { en: 'Question Deck', nl: 'Vragenkaartspel' },
    anotherQuestion: { en: 'Another question', nl: 'Nog een vraag' },
    categoryUnavailable: { en: 'That question category is not available.', nl: 'Die vraagcategorie is niet beschikbaar.' },
    questionsUnavailable: { en: 'No questions are available in that category.', nl: 'Er zijn geen vragen beschikbaar in die categorie.' },
    buttonUnavailable: { en: 'This question button is not available.', nl: 'Deze vragenknop is niet beschikbaar.' },
    categoryFooter: { en: 'Category: {category}', nl: 'Categorie: {category}' },
    'category.any': { en: 'Any category', nl: 'Elke categorie' },
    'category.gaming': { en: 'Gaming', nl: 'Gamen' },
    'category.silly': { en: 'Silly', nl: 'Gek' },
    'category.would-you-rather': { en: 'Would you rather', nl: 'Zou je liever' },
    'category.getting-to-know-you': { en: 'Getting to know you', nl: 'Elkaar leren kennen' },
    'category.deep': { en: 'Deep', nl: 'Diepgaand' },
});

export function questionCategoryCopyKey(category: QuestionCategorySelection): QuestionCopyKey {
    return `category.${category}` as QuestionCopyKey;
}
