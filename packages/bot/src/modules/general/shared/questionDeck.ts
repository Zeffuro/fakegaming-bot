export const QUESTION_CATEGORIES = [
    'gaming',
    'silly',
    'would-you-rather',
    'getting-to-know-you',
    'deep',
] as const;

export type QuestionCategory = typeof QUESTION_CATEGORIES[number];
export type QuestionCategorySelection = QuestionCategory | 'any';

export interface QuestionPromptInput {
    id: string;
    category: string;
    text: string;
}

export interface QuestionPrompt {
    id: string;
    category: QuestionCategory;
    text: string;
}

interface QuestionDeckState {
    lastId: string | null;
    remainingIdsBySelection: Map<QuestionCategorySelection, string[]>;
}

export interface QuestionDeckOptions {
    random?: () => number;
    maxTrackedScopes?: number;
}

const QUESTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_QUESTION_LENGTH = 300;
const DEFAULT_MAX_TRACKED_SCOPES = 500;

export function validateQuestionDataset(input: unknown): readonly QuestionPrompt[] {
    if (!Array.isArray(input) || input.length === 0) {
        throw new Error('Question dataset must be a non-empty array.');
    }

    const ids = new Set<string>();
    const prompts = input.map((value, index): QuestionPrompt => {
        if (!isRecord(value)) throw new Error(`Question at index ${index} must be an object.`);
        const keys = Object.keys(value);
        if (keys.some(key => key !== 'id' && key !== 'category' && key !== 'text')) {
            throw new Error(`Question at index ${index} contains unsupported fields.`);
        }

        const { id, category, text } = value;
        if (typeof id !== 'string' || !QUESTION_ID_PATTERN.test(id)) {
            throw new Error(`Question at index ${index} has an invalid ID.`);
        }
        if (ids.has(id)) throw new Error(`Duplicate question ID '${id}'.`);
        if (!isQuestionCategory(category)) {
            throw new Error(`Question '${id}' has an invalid category.`);
        }
        if (typeof text !== 'string' || text !== text.trim() || text.length === 0 || text.length > MAX_QUESTION_LENGTH) {
            throw new Error(`Question '${id}' must contain 1-${MAX_QUESTION_LENGTH} trimmed characters.`);
        }

        ids.add(id);
        return Object.freeze({ id, category, text });
    });

    return Object.freeze(prompts);
}

export function validateQuestionDatasetParity(
    reference: readonly QuestionPrompt[],
    localized: readonly QuestionPrompt[],
): void {
    const localizedById = new Map(localized.map(prompt => [prompt.id, prompt]));
    if (reference.length !== localized.length) {
        throw new Error('Localized question dataset must contain the same number of prompts as the reference dataset.');
    }

    for (const prompt of reference) {
        const translation = localizedById.get(prompt.id);
        if (!translation) throw new Error(`Localized question dataset is missing '${prompt.id}'.`);
        if (translation.category !== prompt.category) {
            throw new Error(`Localized question '${prompt.id}' must use category '${prompt.category}'.`);
        }
    }
}

export function isQuestionCategory(value: unknown): value is QuestionCategory {
    return typeof value === 'string' && (QUESTION_CATEGORIES as readonly string[]).includes(value);
}

export function isQuestionCategorySelection(value: unknown): value is QuestionCategorySelection {
    return value === 'any' || isQuestionCategory(value);
}

export class QuestionDeck {
    private readonly promptsById: ReadonlyMap<string, QuestionPrompt>;
    private readonly promptsBySelection: ReadonlyMap<QuestionCategorySelection, readonly QuestionPrompt[]>;
    private readonly states = new Map<string, QuestionDeckState>();
    private readonly random: () => number;
    private readonly maxTrackedScopes: number;

    public constructor(prompts: readonly QuestionPrompt[], options: QuestionDeckOptions = {}) {
        if (!Number.isInteger(options.maxTrackedScopes ?? DEFAULT_MAX_TRACKED_SCOPES)
            || (options.maxTrackedScopes ?? DEFAULT_MAX_TRACKED_SCOPES) < 1) {
            throw new Error('maxTrackedScopes must be a positive integer.');
        }

        this.random = options.random ?? Math.random;
        this.maxTrackedScopes = options.maxTrackedScopes ?? DEFAULT_MAX_TRACKED_SCOPES;
        this.promptsById = new Map(prompts.map(prompt => [prompt.id, prompt]));
        this.promptsBySelection = new Map([
            ['any', prompts],
            ...QUESTION_CATEGORIES.map((category) => [
                category,
                prompts.filter(prompt => prompt.category === category),
            ] as const),
        ]);
    }

    public draw(selection: QuestionCategorySelection, scopeKey: string): QuestionPrompt | null {
        const prompts = this.promptsBySelection.get(selection) ?? [];
        if (prompts.length === 0) return null;

        const state = this.getState(scopeKey);
        let remainingIds = state.remainingIdsBySelection.get(selection) ?? [];
        if (remainingIds.length === 0) {
            remainingIds = prompts
                .filter(prompt => prompts.length === 1 || prompt.id !== state.lastId)
                .map(prompt => prompt.id);
            state.remainingIdsBySelection.set(selection, remainingIds);
        }

        let randomIndex = Math.min(
            remainingIds.length - 1,
            Math.max(0, Math.floor(this.random() * remainingIds.length)),
        );
        if (remainingIds.length > 1 && remainingIds[randomIndex] === state.lastId) {
            randomIndex = (randomIndex + 1) % remainingIds.length;
        }
        const [id] = remainingIds.splice(randomIndex, 1);
        const prompt = id ? this.promptsById.get(id) : undefined;
        if (!prompt) return null;

        state.lastId = prompt.id;
        return prompt;
    }

    private getState(key: string): QuestionDeckState {
        const existing = this.states.get(key);
        if (existing) {
            this.states.delete(key);
            this.states.set(key, existing);
            return existing;
        }

        if (this.states.size >= this.maxTrackedScopes) {
            const oldestKey = this.states.keys().next().value as string | undefined;
            if (oldestKey !== undefined) this.states.delete(oldestKey);
        }

        const state: QuestionDeckState = { lastId: null, remainingIdsBySelection: new Map() };
        this.states.set(key, state);
        return state;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
