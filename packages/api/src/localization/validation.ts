import {
    resolveLocaleValue,
    validateBody as commonValidateBody,
    validateBodyForModel as commonValidateBodyForModel,
    validateParams as commonValidateParams,
    validateQuery as commonValidateQuery,
    type ValidatorOptions,
    type OutputLocaleValues,
    type SupportedOutputLocale,
} from '@zeffuro/fakegaming-common';
import type { Model, ModelCtor } from 'sequelize-typescript';
import type { z } from 'zod';
import { apiText, requestLocale } from './locale.js';
import type { ApiCopyKey } from './catalog.js';

export const API_VALIDATION_ISSUE = {
    identifierRequired: 'api.validation.identifierRequired',
    usernameRequired: 'api.validation.usernameRequired',
} as const;

const CUSTOM_ISSUE_KEYS = {
    'Expected time in HH:mm': 'validationExpectedTime',
    'anilistId or title is required': 'validationAnimeIdentifier',
    'Invalid calendar date': 'validationCalendarDate',
    'At least one field must be provided': 'validationOneField',
    'Invalid date-time': 'validationDateTime',
    'recurrenceTimezone is required when recurrence is set': 'validationRecurrenceTimezone',
    'title or body is required': 'validationNoteContent',
    'identifier is required': 'validationIdentifierRequired',
    'username is required': 'validationUsernameRequired',
    [API_VALIDATION_ISSUE.identifierRequired]: 'validationIdentifierRequired',
    [API_VALIDATION_ISSUE.usernameRequired]: 'validationUsernameRequired',
} as const satisfies Readonly<Record<string, ApiCopyKey>>;

const PRESERVE_SOURCE_VALIDATION_MESSAGES = {
    en: true,
    nl: false,
} as const satisfies OutputLocaleValues<boolean>;

const localizedValidation: ValidatorOptions = {
    localizeError: (req, label, issues) => {
        const locale = requestLocale(req);
        const key = label === 'Body' ? 'validationBody' : label === 'Query' ? 'validationQuery' : 'validationParams';
        const input = label === 'Body' ? req.body : label === 'Query' ? req.query : req.params;
        return {
            message: apiText(locale, key),
            details: issues.map(issue => ({
                path: issue.path.map(segment => String(segment)).join('.'),
                message: localizeIssue(locale, issue, input),
            })),
        };
    },
};

export const validateBody = <T extends z.ZodTypeAny>(schema: T) => commonValidateBody(schema, localizedValidation);
export const validateQuery = <T extends z.ZodTypeAny>(schema: T) => commonValidateQuery(schema, localizedValidation);
export const validateParams = <T extends z.ZodTypeAny>(schema: T) => commonValidateParams(schema, localizedValidation);
export const validateBodyForModel = <T extends Model>(model: ModelCtor<T>, type: 'create' | 'update' | 'full' = 'full') =>
    commonValidateBodyForModel(model, type, localizedValidation);

function localizeIssue(locale: SupportedOutputLocale, issue: z.core.$ZodIssue, input: unknown): string {
    const customKey = CUSTOM_ISSUE_KEYS[issue.message as keyof typeof CUSTOM_ISSUE_KEYS];
    if (customKey) return apiText(locale, customKey);
    if (resolveLocaleValue(locale, PRESERVE_SOURCE_VALIDATION_MESSAGES)) return issue.message;
    if (issue.code === 'invalid_type' && valueAtPath(input, issue.path) === undefined) {
        return apiText(locale, 'validationRequired');
    }
    if (issue.code === 'invalid_type') return apiText(locale, issue.expected === 'string'
        ? 'validationString'
        : issue.expected === 'number'
            ? 'validationNumber'
            : issue.expected === 'boolean'
                ? 'validationBoolean'
                : issue.expected === 'array'
                    ? 'validationArray'
                    : 'validationInvalid');
    if (issue.code === 'too_small') return apiText(locale, 'validationTooSmall');
    if (issue.code === 'too_big') return apiText(locale, 'validationTooBig');
    if (issue.code === 'invalid_format') return apiText(locale, 'validationFormat');
    return apiText(locale, 'validationInvalid');
}

function valueAtPath(input: unknown, path: ReadonlyArray<PropertyKey>): unknown {
    let value = input;
    for (const segment of path) {
        if ((typeof value !== 'object' || value === null) || !(segment in value)) return undefined;
        value = (value as Record<PropertyKey, unknown>)[segment];
    }
    return value;
}
