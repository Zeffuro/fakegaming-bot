import { describe, expect, it } from 'vitest';
import { DiscordAPIError } from 'discord.js';
import { SubmissionControlError } from '../shared/copy.js';
import { submissionErrorDiagnostics } from '../shared/diagnostics.js';

describe('submission error diagnostics', () => {
    it('omits arbitrary messages, stack traces, error names and codes', () => {
        const error = Object.assign(new Error('PRIVATE TEXT'), { name: 'PRIVATE NAME', code: 'PRIVATE CODE',
            url: 'https://private.example', requestBody: { token: 'PRIVATE TOKEN' }, details: { reason: 'PRIVATE DETAILS' } });
        expect(submissionErrorDiagnostics(error)).toEqual({ errorType: 'Error' });
    });

    it('preserves nested Discord status and code after an access check wraps it', () => {
        const discord = new DiscordAPIError({ message: 'PRIVATE TEXT', code: 50001 }, 50001, 403, 'GET', 'PRIVATE URL', {});
        expect(submissionErrorDiagnostics(new SubmissionControlError('setup', { cause: discord }))).toEqual({
            errorType: 'Error', errorCode: 'setup', causeType: 'DiscordAPIError', httpStatus: 403, causeCode: 50001,
        });
    });

    it('bounds cyclic causes and extracts known database codes without SQL', () => {
        const error = Object.assign(new Error('PRIVATE QUERY'), { original: { code: '23505', sql: 'PRIVATE SQL' } });
        expect(submissionErrorDiagnostics(error)).toEqual({ errorType: 'Error', causeCode: '23505' });
        error.cause = error;
        expect(submissionErrorDiagnostics(error)).toEqual({ errorType: 'Error', causeType: 'Error' });
    });
});
