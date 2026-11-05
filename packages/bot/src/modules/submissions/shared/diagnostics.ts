import { DiscordAPIError, HTTPError } from 'discord.js';
import { getLogger, sanitizeAuditMetadata } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { SubmissionControlError } from './copy.js';

const log = getLogger({ name: 'bot:submissions' });
const safeCodes = new Set([
    'unavailable', 'setup', 'missing', 'imagesInvalid', 'invalid-content', 'invalid-category', 'category-limit',
    'not-found', 'stale', 'forbidden', 'cooldown', 'active-limit', 'invalid-state', 'invalid-attachments',
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH',
    'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET',
    'UND_ERR_ABORTED', 'UND_ERR_REQ_CONTENT_LENGTH_MISMATCH', 'CERT_HAS_EXPIRED',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    '23502', '23503', '23505', '40001', '40P01', '08006', '57014', '57P01', 'SQLITE_BUSY', 'SQLITE_CONSTRAINT',
]);
const safeNames = new Set(['Error', 'TypeError', 'RangeError', 'AbortError', 'TimeoutError', 'AggregateError',
    'SubmissionError', 'SequelizeDatabaseError', 'SequelizeConnectionError', 'SequelizeUniqueConstraintError']);

type FailureReason = 'image-count-limit' | 'image-total-limit' | 'image-size-invalid' | 'image-id-invalid'
    | 'image-type-unsupported' | 'image-url-invalid' | 'image-download-http' | 'image-body-missing'
    | 'image-download-network' | 'image-stream-read' | 'image-stream-limit' | 'image-size-mismatch' | 'image-signature-invalid' | 'image-type-mismatch'
    | 'saved-attachment-missing' | 'invalid-channel' | 'invalid-role' | 'review-access' | 'destination-write'
    | 'bot-permissions' | 'reviewer-access';
type DiagnosticMetadata = Record<string, string | number | boolean | null | undefined>;

export class SubmissionDiagnosticError extends Error {
    constructor(readonly code: ConstructorParameters<typeof SubmissionControlError>[0] | undefined,
        readonly details: DiagnosticMetadata & { reason: FailureReason }, options?: ErrorOptions) {
        super(code ?? 'Submission media transfer failed', options);
    }
}

export function submissionErrorDiagnostics(error: unknown): DiagnosticMetadata {
    const result: DiagnosticMetadata = { errorType: 'unknown' };
    if (error instanceof Error) result.errorType = safeNames.has(error.name) ? error.name : 'Error';
    if (error instanceof SubmissionDiagnosticError) Object.assign(result, error.details);
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
        if (current instanceof Error && safeNames.has(current.name) && depth > 0) result.causeType = current.name;
        if (current instanceof DiscordAPIError || current instanceof HTTPError) {
            result[depth === 0 ? 'errorType' : 'causeType'] = current instanceof DiscordAPIError ? 'DiscordAPIError' : 'HTTPError';
            result.httpStatus = current.status;
            if (current instanceof DiscordAPIError && typeof current.code === 'number') result[depth === 0 ? 'errorCode' : 'causeCode'] = current.code;
        }
        const value = current as { code?: unknown; cause?: unknown; original?: unknown; errors?: unknown[] };
        if (typeof value.code === 'string' && safeCodes.has(value.code)) {
            result[depth === 0 ? 'errorCode' : 'causeCode'] = value.code;
        }
        current = value.cause ?? value.original ?? (current instanceof AggregateError ? value.errors?.[0] : undefined);
    }
    return result;
}

export async function reportSubmissionFailure(context: {
    guildId: string; categoryId: string; userId: string; submissionId?: string; revision: boolean;
}, metadata: DiagnosticMetadata): Promise<void> {
    try {
        await getConfigManager().auditEventManager.record({
            actorId: context.userId, actorType: 'user', guildId: context.guildId,
            action: 'submission.upload.failed', targetType: 'submission', targetId: context.submissionId ?? null,
            severity: 'error', status: 'failure',
            metadata: sanitizeAuditMetadata({ ...metadata, source: 'discordSubmission', categoryId: context.categoryId, revision: context.revision }),
        });
    } catch (error) {
        log.warn({ ...submissionErrorDiagnostics(error), submissionId: context.submissionId }, 'Submission failure audit persistence failed');
    }
}
