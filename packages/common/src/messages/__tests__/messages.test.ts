import { describe, expect, it } from 'vitest';
import { createTranslator } from 'use-intl/core';
import {
    TYPE,
    parse,
    type MessageFormatElement,
    type PluralElement,
    type SelectElement,
} from '@formatjs/icu-messageformat-parser';
import { getCommonMessages } from '../index.js';
import { getLocaleMetadata, SUPPORTED_LOCALES } from '../../utils/outputLocale.js';

function flattenMessages(value: unknown, prefix = ''): Map<string, string> {
    const messages = new Map<string, string>();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return messages;

    for (const [key, nested] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof nested === 'string') {
            messages.set(path, nested);
        } else {
            for (const [nestedKey, message] of flattenMessages(nested, path)) {
                messages.set(nestedKey, message);
            }
        }
    }
    return messages;
}

function argumentNames(message: string): string[] {
    const names = new Set<string>();
    collectArgumentNames(parse(message), names);
    return [...names].sort();
}

function collectArgumentNames(elements: readonly MessageFormatElement[], names: Set<string>): void {
    for (const element of elements) {
        if (element.type === TYPE.argument
            || element.type === TYPE.number
            || element.type === TYPE.date
            || element.type === TYPE.time
            || element.type === TYPE.select
            || element.type === TYPE.plural) {
            names.add(element.value);
        }
        if (element.type === TYPE.select || element.type === TYPE.plural) {
            const options = (element as SelectElement | PluralElement).options;
            for (const option of Object.values(options)) {
                collectArgumentNames(option.value, names);
            }
        } else if (element.type === TYPE.tag) {
            collectArgumentNames(element.children, names);
        }
    }
}

describe('common message catalogs', () => {
    it('keeps every enabled locale aligned with the English source catalog', () => {
        const english = flattenMessages(getCommonMessages('en'));
        const dutch = flattenMessages(getCommonMessages('nl'));

        expect([...dutch.keys()].sort()).toEqual([...english.keys()].sort());
        for (const [key, source] of english) {
            const translation = dutch.get(key);
            expect(translation, key).toBeTruthy();
            expect(argumentNames(translation ?? ''), key).toEqual(argumentNames(source));
        }
    });

    it('renders every message without ICU errors', () => {
        for (const locale of SUPPORTED_LOCALES) {
            const errors: unknown[] = [];
            const messages = getCommonMessages(locale);
            const translate = createTranslator({
                locale: getLocaleMetadata(locale).formatTag,
                messages,
                onError: error => errors.push(error),
            });

            for (const [key, message] of flattenMessages(messages)) {
                const values = Object.fromEntries(argumentNames(message).map(name => [name, 2]));
                const rendered = translate(key as never, values as never);
                expect(rendered, `${locale}:${key}`).toBeTypeOf('string');
                expect(rendered.length, `${locale}:${key}`).toBeGreaterThan(0);
            }

            expect(errors, locale).toEqual([]);
        }
    });
});
