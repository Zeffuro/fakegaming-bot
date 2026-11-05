import { AttachmentBuilder, type Attachment } from 'discord.js';
import { SubmissionDiagnosticError } from './diagnostics.js';

export const SUBMISSION_IMAGE_LIMIT = 8 * 1024 * 1024;
export const SUBMISSION_TOTAL_LIMIT = 20 * 1024 * 1024;
type ImageInput = Pick<Attachment, 'id' | 'url' | 'size' | 'contentType'>;
export interface SubmissionImage {
    file: AttachmentBuilder;
    name: string;
    contentType: string;
    size: number;
}

export function validateImageInputs(images: ImageInput[]): void {
    if (images.length > 4) invalidImage({ reason: 'image-count-limit', imageCount: images.length });
    if (images.reduce((sum, file) => sum + file.size, 0) > SUBMISSION_TOTAL_LIMIT) invalidImage({ reason: 'image-total-limit' });
    for (const [index, image] of images.entries()) {
        const details = { imageIndex: index + 1, expectedBytes: Number.isFinite(image.size) ? image.size : null };
        if (!Number.isInteger(image.size) || image.size < 1 || image.size > SUBMISSION_IMAGE_LIMIT) invalidImage({ ...details, reason: 'image-size-invalid' });
        if (!/^\d+$/.test(image.id)) invalidImage({ ...details, reason: 'image-id-invalid' });
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.contentType ?? '')) invalidImage({ ...details, reason: 'image-type-unsupported' });
        let url: URL;
        try { url = new URL(image.url); } catch { invalidImage({ ...details, reason: 'image-url-invalid' }); }
        if (url.protocol !== 'https:' || url.hostname !== 'cdn.discordapp.com' || url.port || url.username || url.password
            || !new RegExp(`^/(?:ephemeral-)?attachments/\\d+/${image.id}/[^/]+$`).test(url.pathname)) invalidImage({ ...details, reason: 'image-url-invalid' });
    }
}

export async function downloadSubmissionImages(images: ImageInput[], fetcher: typeof fetch = fetch): Promise<SubmissionImage[]> {
    validateImageInputs(images);
    const result: SubmissionImage[] = [];
    let total = 0;
    for (const image of images) {
        const details = { imageIndex: result.length + 1, expectedBytes: image.size, expectedContentType: image.contentType };
        let response: Response;
        try {
            response = await fetcher(image.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
        } catch (error) {
            throw new SubmissionDiagnosticError(undefined, { ...details, reason: 'image-download-network' }, { cause: error });
        }
        if (!response.ok) invalidImage({ ...details, reason: 'image-download-http', httpStatus: response.status });
        if (!response.body) invalidImage({ ...details, reason: 'image-body-missing' });
        const chunks: Uint8Array[] = [];
        let size = 0;
        const reader = response.body.getReader();
        try {
            for (;;) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > image.size || size > SUBMISSION_IMAGE_LIMIT || total + size > SUBMISSION_TOTAL_LIMIT) invalidImage({ ...details, reason: 'image-stream-limit', actualBytes: size });
                chunks.push(chunk.value);
            }
        } catch (error) {
            if (error instanceof SubmissionDiagnosticError) throw error;
            throw new SubmissionDiagnosticError(undefined, { ...details, reason: 'image-stream-read', actualBytes: size }, { cause: error });
        } finally { await reader.cancel().catch(() => undefined); }
        if (size !== image.size) invalidImage({ ...details, reason: 'image-size-mismatch', actualBytes: size });
        const bytes = Buffer.concat(chunks);
        const kind = imageKind(bytes);
        if (!kind) invalidImage({ ...details, reason: 'image-signature-invalid', actualBytes: size });
        if (kind.contentType !== image.contentType) invalidImage({ ...details, reason: 'image-type-mismatch', detectedContentType: kind.contentType });
        const name = `screenshot-${result.length + 1}.${kind.extension}`;
        result.push({ file: new AttachmentBuilder(bytes, { name }), name, contentType: kind.contentType, size });
        total += size;
    }
    return result;
}

function imageKind(bytes: Buffer): { extension: string; contentType: string } | null {
    if (bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        && bytes.toString('ascii', 12, 16) === 'IHDR') return { extension: 'png', contentType: 'image/png' };
    if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', contentType: 'image/jpeg' };
    if (bytes.length > 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
        return { extension: 'webp', contentType: 'image/webp' };
    }
    return null;
}

function invalidImage(details: ConstructorParameters<typeof SubmissionDiagnosticError>[1]): never {
    throw new SubmissionDiagnosticError('imagesInvalid', details);
}
