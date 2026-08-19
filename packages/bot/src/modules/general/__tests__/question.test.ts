import {
    Locale,
    MessageFlags,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
} from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import questionCommand, {
    buildQuestionMessage,
    createQuestionComponentHandler,
    resolveQuestionOutputLocale,
} from '../commands/question.js';
import { ENGLISH_QUESTION_PROMPTS } from '../data/questions.en.js';
import { DUTCH_QUESTION_PROMPTS } from '../data/questions.nl.js';
import {
    QUESTION_CATEGORIES,
    QuestionDeck,
    validateQuestionDataset,
    validateQuestionDatasetParity,
    type QuestionPromptInput,
} from '../shared/questionDeck.js';

const SMALL_DATASET: readonly QuestionPromptInput[] = [
    { id: 'gaming-one', category: 'gaming', text: 'Gaming question one?' },
    { id: 'gaming-two', category: 'gaming', text: 'Gaming question two?' },
    { id: 'silly-one', category: 'silly', text: 'Silly question one?' },
];

function button(customId: string, userId = 'user-1', channelId = 'channel-1'): ButtonInteraction & {
    reply: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
} {
    return {
        customId,
        channelId,
        user: { id: userId },
        reply: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ButtonInteraction & {
        reply: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
}

describe('question dataset', () => {
    it('contains balanced English and Dutch catalogs with matching IDs and categories', () => {
        const prompts = validateQuestionDataset(ENGLISH_QUESTION_PROMPTS);
        const dutchPrompts = validateQuestionDataset(DUTCH_QUESTION_PROMPTS);

        expect(prompts).toHaveLength(50);
        expect(dutchPrompts).toHaveLength(50);
        expect(new Set(prompts.map(prompt => prompt.id)).size).toBe(50);
        validateQuestionDatasetParity(prompts, dutchPrompts);
        for (const category of QUESTION_CATEGORIES) {
            expect(prompts.filter(prompt => prompt.category === category)).toHaveLength(10);
            expect(dutchPrompts.filter(prompt => prompt.category === category)).toHaveLength(10);
        }
    });

    it('rejects localized datasets that omit an ID or change its category', () => {
        const reference = validateQuestionDataset(SMALL_DATASET);
        expect(() => validateQuestionDatasetParity(reference, validateQuestionDataset([
            { id: 'gaming-unknown', category: 'gaming', text: 'Different question?' },
            SMALL_DATASET[1],
            SMALL_DATASET[2],
        ]))).toThrow("missing 'gaming-one'");
        expect(() => validateQuestionDatasetParity(reference, validateQuestionDataset([
            { ...SMALL_DATASET[0], category: 'silly' },
            SMALL_DATASET[1],
            SMALL_DATASET[2],
        ]))).toThrow("must use category 'gaming'");
    });

    it('rejects empty, duplicate, malformed, and unsupported entries', () => {
        expect(() => validateQuestionDataset([])).toThrow('non-empty array');
        expect(() => validateQuestionDataset([
            SMALL_DATASET[0],
            SMALL_DATASET[0],
        ])).toThrow("Duplicate question ID 'gaming-one'.");
        expect(() => validateQuestionDataset([
            { id: 'unknown-one', category: 'unknown', text: 'Question?' },
        ])).toThrow('invalid category');
        expect(() => validateQuestionDataset([
            { id: 'bad spaces', category: 'gaming', text: 'Question?' },
        ])).toThrow('invalid ID');
        expect(() => validateQuestionDataset([
            { id: 'gaming-extra', category: 'gaming', text: 'Question?', extra: true },
        ])).toThrow('unsupported fields');
        expect(() => validateQuestionDataset([
            { id: 'gaming-blank', category: 'gaming', text: '   ' },
        ])).toThrow('trimmed characters');
    });
});

describe('QuestionDeck', () => {
    it('filters by category and avoids repeats until a category is exhausted', () => {
        const deck = new QuestionDeck(validateQuestionDataset(SMALL_DATASET), { random: () => 0 });

        const first = deck.draw('gaming', 'channel:one');
        const second = deck.draw('gaming', 'channel:one');
        const afterRefill = deck.draw('gaming', 'channel:one');

        expect(first?.category).toBe('gaming');
        expect(second?.category).toBe('gaming');
        expect(first?.id).not.toBe(second?.id);
        expect(afterRefill?.id).toBe(first?.id);
    });

    it('tracks repeat prevention independently by scope and selection', () => {
        const deck = new QuestionDeck(validateQuestionDataset(SMALL_DATASET), { random: () => 0 });

        expect(deck.draw('gaming', 'channel:one')?.id).toBe('gaming-one');
        expect(deck.draw('gaming', 'channel:two')?.id).toBe('gaming-one');
        expect(deck.draw('silly', 'channel:one')?.id).toBe('silly-one');
        expect(deck.draw('any', 'channel:one')?.id).toBe('gaming-one');
    });

    it('avoids an immediate repeat when a scope switches category selections', () => {
        const deck = new QuestionDeck(validateQuestionDataset(SMALL_DATASET), { random: () => 0 });

        const categoryPrompt = deck.draw('gaming', 'channel:one');
        const anyPrompt = deck.draw('any', 'channel:one');

        expect(categoryPrompt?.id).toBe('gaming-one');
        expect(anyPrompt?.id).toBe('gaming-two');
    });

    it('returns null for an empty category in a valid custom dataset', () => {
        const deck = new QuestionDeck(validateQuestionDataset([SMALL_DATASET[0]]));

        expect(deck.draw('deep', 'channel:one')).toBeNull();
    });

    it('bounds tracked scopes and resets an evicted scope safely', () => {
        const deck = new QuestionDeck(validateQuestionDataset(SMALL_DATASET), {
            random: () => 0,
            maxTrackedScopes: 1,
        });

        expect(deck.draw('gaming', 'channel:one')?.id).toBe('gaming-one');
        expect(deck.draw('gaming', 'channel:two')?.id).toBe('gaming-one');
        expect(deck.draw('gaming', 'channel:one')?.id).toBe('gaming-one');
    });
});

describe('/question', () => {
    it('registers all categories plus the any-category default and private mode', () => {
        const json = questionCommand.data.toJSON();
        const category = json.options?.find(option => option.name === 'category');
        const privateOption = json.options?.find(option => option.name === 'private');

        expect(category).toMatchObject({ required: false });
        const choices = category && 'choices' in category ? category.choices : [];
        expect(choices).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'Any category', value: 'any' }),
            expect.objectContaining({ name: 'Would you rather', value: 'would-you-rather' }),
        ]));
        expect(choices).toHaveLength(6);
        expect(privateOption).toMatchObject({ required: false });
    });

    it('renders a safe prompt payload and preserves selection in the next button', () => {
        const [prompt] = validateQuestionDataset(SMALL_DATASET);
        if (!prompt) throw new Error('Expected a prompt fixture.');

        const payload = buildQuestionMessage(prompt, 'gaming', false);
        const embed = payload.embeds[0]?.toJSON();
        const buttonJson = payload.components[0]?.components[0]?.toJSON();

        expect(embed).toMatchObject({
            title: 'Question Deck',
            description: 'Gaming question one?',
            footer: { text: 'Category: Gaming' },
        });
        expect(buttonJson).toMatchObject({ custom_id: 'question:next:gaming:public:en' });
        expect(payload.allowedMentions).toEqual({ parse: [] });
    });

    it('renders localized application copy for the Dutch catalog', () => {
        const [prompt] = validateQuestionDataset(DUTCH_QUESTION_PROMPTS);
        if (!prompt) throw new Error('Expected a Dutch prompt fixture.');

        const payload = buildQuestionMessage(prompt, 'gaming', false, 'nl');
        const embed = payload.embeds[0]?.toJSON();
        const buttonJson = payload.components[0]?.components[0]?.toJSON();

        expect(embed).toMatchObject({
            title: 'Vragenkaartspel',
            footer: { text: 'Categorie: Gamen' },
        });
        expect(buttonJson).toMatchObject({
            custom_id: 'question:next:gaming:public:nl',
            label: 'Nog een vraag',
        });
    });

    it('uses private user scopes and ephemeral replies when requested', async () => {
        const reply = vi.fn().mockResolvedValue(undefined);
        const interaction = {
            channelId: 'channel-1',
            user: { id: 'user-1' },
            options: {
                getString: vi.fn().mockReturnValue('silly'),
                getBoolean: vi.fn().mockReturnValue(true),
            },
            reply,
        } as unknown as ChatInputCommandInteraction;

        await questionCommand.execute(interaction);

        expect(reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
        const payload = reply.mock.calls[0]?.[0] as ReturnType<typeof buildQuestionMessage>;
        expect(payload.components[0]?.components[0]?.toJSON()).toMatchObject({
            custom_id: 'question:next:silly:private:en',
        });
    });

    it('uses a stored guild locale for the response', async () => {
        vi.mocked(getConfigManager().guildLocaleConfigManager.getOutputLocale).mockResolvedValueOnce('nl');
        const reply = vi.fn().mockResolvedValue(undefined);
        const interaction = {
            channelId: 'channel-nl',
            guildId: 'guild-nl',
            guildLocale: 'nl',
            user: { id: 'user-nl' },
            options: {
                getString: vi.fn().mockReturnValue('gaming'),
                getBoolean: vi.fn().mockReturnValue(false),
            },
            reply,
        } as unknown as ChatInputCommandInteraction;

        await questionCommand.execute(interaction);

        const payload = reply.mock.calls[0]?.[0] as ReturnType<typeof buildQuestionMessage>;
        expect(payload.embeds[0]?.toJSON()).toMatchObject({ title: 'Vragenkaartspel' });
        expect(payload.components[0]?.components[0]?.toJSON()).toMatchObject({
            custom_id: 'question:next:gaming:public:nl',
            label: 'Nog een vraag',
        });
    });

    it('prefers stored guild locale and does not look up a locale for direct messages', async () => {
        const getStoredGuildLocale = vi.fn(async () => 'en');
        await expect(resolveQuestionOutputLocale({ guildId: 'guild-1', guildLocale: Locale.Dutch }, getStoredGuildLocale))
            .resolves.toBe('en');
        expect(getStoredGuildLocale).toHaveBeenCalledWith('guild-1');

        getStoredGuildLocale.mockClear();
        await expect(resolveQuestionOutputLocale({ guildId: null, guildLocale: Locale.Dutch }, getStoredGuildLocale))
            .resolves.toBe('nl');
        expect(getStoredGuildLocale).not.toHaveBeenCalled();
    });

    it('advances valid public buttons and keeps repeat state per channel', async () => {
        const deck = new QuestionDeck(validateQuestionDataset(SMALL_DATASET), { random: () => 0 });
        const handleComponent = createQuestionComponentHandler(() => deck);
        const first = button('question:next:gaming:public:en', 'user-1', 'channel-1');
        const second = button('question:next:gaming:public:en', 'user-2', 'channel-1');

        await expect(handleComponent(first)).resolves.toBe(true);
        await expect(handleComponent(second)).resolves.toBe(true);

        const firstPayload = first.update.mock.calls[0]?.[0] as ReturnType<typeof buildQuestionMessage>;
        const secondPayload = second.update.mock.calls[0]?.[0] as ReturnType<typeof buildQuestionMessage>;
        expect(firstPayload.embeds[0]?.toJSON().description).toBe('Gaming question one?');
        expect(secondPayload.embeds[0]?.toJSON().description).toBe('Gaming question two?');
    });

    it('rejects malformed question IDs without claiming another namespace', async () => {
        const deck = new QuestionDeck(validateQuestionDataset(SMALL_DATASET));
        const handleComponent = createQuestionComponentHandler(() => deck);
        const malformed = button('question:next:unknown:public');
        const foreign = button('poll:vote:one:0');

        await expect(handleComponent(malformed)).resolves.toBe(true);
        expect(malformed.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: 'This question button is not available.',
            flags: MessageFlags.Ephemeral,
        }));
        await expect(handleComponent(foreign)).resolves.toBe(false);
    });

    it('keeps existing four-part button IDs usable as English after deployment', async () => {
        const deck = new QuestionDeck(validateQuestionDataset(SMALL_DATASET), { random: () => 0 });
        const handleComponent = createQuestionComponentHandler(() => deck);
        const legacyButton = button('question:next:gaming:public');

        await expect(handleComponent(legacyButton)).resolves.toBe(true);
        expect(legacyButton.update).toHaveBeenCalledWith(expect.objectContaining({
            components: expect.any(Array),
        }));
        const payload = legacyButton.update.mock.calls[0]?.[0] as ReturnType<typeof buildQuestionMessage>;
        expect(payload.components[0]?.components[0]?.toJSON()).toMatchObject({
            custom_id: 'question:next:gaming:public:en',
        });
    });
});
