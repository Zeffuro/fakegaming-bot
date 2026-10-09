import { ApplicationCommandOptionType, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import type { LoadedCommand } from '../../../core/FakegamingBot.js';

export const PRESET_COMMANDS = ['weather', 'time', 'get-patchnotes', 'league-form', 'league-history', 'league-stats',
    'tft-history', 'tft-stats', 'stream-status', 'twitch-latest-vod', 'youtube-latest', 'media search', 'anime search', 'manga', 'roll'] as const;

interface OptionDefinition {
    name: string; type: number; required?: boolean; options?: OptionDefinition[];
    choices?: Array<{ value: string | number }>; min_value?: number; max_value?: number; min_length?: number; max_length?: number;
}
interface PresetOption { name: string; type: number; value: string | number | boolean }

export function parsePresetArguments(input: string): Record<string, string> {
    const text = input.trim();
    if (!text) return {};
    const matches: Array<{ key: string; index: number; valueStart: number }> = [];
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (escaped) { escaped = false; continue; }
        if (quoted && character === '\\') { escaped = true; continue; }
        if (character === '"') { quoted = !quoted; continue; }
        if (quoted || (index !== 0 && !/\s/.test(text[index - 1]!))) continue;
        const match = /^([a-z][a-z0-9-]*):/.exec(text.slice(index));
        if (match) { matches.push({ key: match[1]!, index, valueStart: index + match[0].length }); index += match[0].length - 1; }
    }
    if (quoted || escaped || !matches.length || matches[0]!.index !== 0) throw new Error('invalid-preset-options');
    const result: Record<string, string> = Object.create(null) as Record<string, string>;
    for (let index = 0; index < matches.length; index++) {
        const match = matches[index]!;
        const key = match.key;
        let value = text.slice(match.valueStart, matches[index + 1]?.index ?? text.length).trim();
        if (value.startsWith('"')) value = JSON.parse(value) as string;
        if (!value || Object.hasOwn(result, key)) throw new Error('invalid-preset-options');
        result[key] = value;
    }
    return result;
}

export function validatePreset(command: LoadedCommand, path: string, args: Record<string, string>): PresetOption[] {
    if (!PRESET_COMMANDS.includes(path as typeof PRESET_COMMANDS[number])) throw new Error('unsupported-preset-command');
    const schema = command.data.toJSON?.() as { options?: OptionDefinition[]; default_member_permissions?: unknown } | undefined;
    if (!schema || schema.default_member_permissions) throw new Error('unsupported-preset-command');
    const subcommand = path.split(' ')[1];
    const definitions = subcommand ? schema.options?.find(option => option.name === subcommand && option.type === 1)?.options : schema.options;
    if (subcommand && !definitions) throw new Error('unsupported-preset-command');
    const byName = new Map((definitions ?? []).map(option => [option.name, option]));
    for (const definition of definitions ?? []) {
        if (definition.required && !Object.hasOwn(args, definition.name)) throw new Error('missing-preset-options');
    }
    return Object.entries(args).map(([name, input]) => {
        const definition = byName.get(name);
        if (!definition) throw new Error('invalid-preset-options');
        let value: string | number | boolean = input;
        if (definition.type === ApplicationCommandOptionType.Boolean) {
            if (input !== 'true' && input !== 'false') throw new Error('invalid-preset-options');
            value = input === 'true';
        } else if (definition.type === ApplicationCommandOptionType.Integer || definition.type === ApplicationCommandOptionType.Number) {
            value = Number(input);
            if (!Number.isFinite(value) || (definition.type === ApplicationCommandOptionType.Integer && !Number.isSafeInteger(value))
                || (definition.min_value !== undefined && value < definition.min_value)
                || (definition.max_value !== undefined && value > definition.max_value)) throw new Error('invalid-preset-options');
        } else if (definition.type === ApplicationCommandOptionType.String) {
            if (input.length < (definition.min_length ?? 0) || input.length > (definition.max_length ?? 2000)) throw new Error('invalid-preset-options');
        } else throw new Error('unsupported-preset-option');
        if (definition.choices && !definition.choices.some(choice => choice.value === value)) throw new Error('invalid-preset-options');
        return { name, type: definition.type, value };
    });
}

export function presetInteraction(interaction: ChatInputCommandInteraction, path: string, values: PresetOption[]): ChatInputCommandInteraction {
    const byName = new Map(values.map(value => [value.name, value]));
    const getters: Record<string, unknown> = {
        data: values,
        getSubcommand: () => path.split(' ')[1] ?? null,
        getSubcommandGroup: () => null,
        get: (name: string, required = false) => {
            const option = byName.get(name);
            if (!option && required) throw new Error('missing-preset-options');
            return option ?? null;
        },
    };
    for (const method of ['getString', 'getInteger', 'getNumber', 'getBoolean']) {
        getters[method] = (name: string, required = false) => {
            const option = byName.get(name);
            if (!option && required) throw new Error('missing-preset-options');
            return option?.value ?? null;
        };
    }
    for (const method of ['getUser', 'getMember', 'getChannel', 'getRole', 'getMentionable', 'getAttachment']) {
        getters[method] = (_name: string, required = false) => {
            if (required) throw new Error('unsupported-preset-option');
            return null;
        };
    }
    const options = new Proxy(interaction.options, { get(target, property) {
        if (typeof property === 'string' && Object.hasOwn(getters, property)) return getters[property];
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
    } });
    return new Proxy(interaction, { get(target, property) {
        if (property === 'options') return options;
        if (property === 'commandName') return path.split(' ')[0];
        if (property === 'reply') return async (payload: unknown) => target.editReply(privateReplyPayload(payload));
        if (property === 'followUp') return async (payload: unknown) => target.followUp({ ...privateReplyPayload(payload), flags: MessageFlags.Ephemeral });
        if (property === 'editReply') return async (payload: unknown) => target.editReply(privateReplyPayload(payload));
        if (property === 'deferReply') return async () => undefined;
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}

function privateReplyPayload(value: unknown): Record<string, unknown> & { allowedMentions: { parse: [] } } {
    if (typeof value === 'string') return { content: value, allowedMentions: { parse: [] } };
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-preset-response');
    const { flags: _flags, ephemeral: _ephemeral, fetchReply: _fetchReply, withResponse: _response, ...payload } = value as Record<string, unknown>;
    return { ...payload, allowedMentions: { parse: [] } };
}
