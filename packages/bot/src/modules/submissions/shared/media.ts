import { AttachmentBuilder, type Attachment } from 'discord.js';
import { SubmissionControlError } from './copy.js';

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
    if (images.length > 4 || images.reduce((sum, file) => sum + file.size, 0) > SUBMISSION_TOTAL_LIMIT) invalidImage();
    for (const image of images) {
        if (!Number.isInteger(image.size) || image.size < 1 || image.size > SUBMISSION_IMAGE_LIMIT
            || !/^\d+$/.test(image.id) || !['image/png', 'image/jpeg', 'image/webp'].includes(image.contentType ?? '')) invalidImage();
        let url: URL;
        try { url = new URL(image.url); } catch { invalidImage(); }
        if (url.protocol !== 'https:' || url.hostname !== 'cdn.discordapp.com' || url.port || url.username || url.password
            || !new RegExp(`^/(?:ephemeral-)?attachments/\\d+/${image.id}/[^/]+$`).test(url.pathname)) invalidImage();
    }
}

export async function downloadSubmissionImages(images: ImageInput[], fetcher: typeof fetch = fetch): Promise<SubmissionImage[]> {
    validateImageInputs(images);
    const result: SubmissionImage[] = [];
    let total = 0;
    for (const image of images) {
        const response = await fetcher(image.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
        if (!response.ok || !response.body) invalidImage();
        const chunks: Uint8Array[] = [];
        let size = 0;
        const reader = response.body.getReader();
        try {
            for (;;) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > image.size || size > SUBMISSION_IMAGE_LIMIT || total + size > SUBMISSION_TOTAL_LIMIT) invalidImage();
                chunks.push(chunk.value);
            }
        } finally { await reader.cancel().catch(() => undefined); }
        if (size !== image.size) invalidImage();
        const bytes = Buffer.concat(chunks);
        const kind = imageKind(bytes);
        if (!kind || kind.contentType !== image.contentType) invalidImage();
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

function invalidImage(): never { throw new SubmissionControlError('imagesInvalid'); }
