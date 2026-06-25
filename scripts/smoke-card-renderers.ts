import { createCanvas, loadImage } from 'canvas';
import { renderProfileCard } from '../packages/common/src/profile-card/index.js';
import { renderQuoteCard } from '../packages/common/src/quote-card/index.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface SmokeCard {
    name: string;
    buffer: Buffer;
    expectedWidth: number;
    expectedHeight: number;
    minBytes: number;
}

async function main(): Promise<void> {
    const cards: SmokeCard[] = [
        {
            name: 'quote card',
            buffer: renderQuoteCard({
                quote: 'Production card rendering should survive container fonts and native canvas libraries.',
                authorName: 'Smoke Test',
                authorId: '123456789012345678',
                submitterName: 'CI',
                timestamp: 1782400000000,
                tags: ['smoke', 'docker'],
                source: 'card renderer smoke',
                context: 'Native canvas validation',
                guildName: 'FakeGaming',
            }),
            expectedWidth: 1200,
            expectedHeight: 630,
            minBytes: 10_000,
        },
        {
            name: 'profile card',
            buffer: renderProfileCard({
                userId: '123456789012345678',
                displayName: 'Container Smoke',
                username: 'container-smoke',
                discriminator: '0',
                globalName: 'Container Smoke',
                nickname: 'Smoke',
                guildName: 'FakeGaming',
            }),
            expectedWidth: 1000,
            expectedHeight: 560,
            minBytes: 8_000,
        },
    ];

    for (const card of cards) {
        await assertRenderableCard(card);
    }

    console.log(`Rendered ${cards.length} card smoke images successfully.`);
}

async function assertRenderableCard(card: SmokeCard): Promise<void> {
    if (!card.buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
        throw new Error(`${card.name} did not render a PNG buffer`);
    }

    if (card.buffer.length < card.minBytes) {
        throw new Error(`${card.name} PNG is unexpectedly small: ${card.buffer.length} bytes`);
    }

    const image = await loadImage(card.buffer);
    if (image.width !== card.expectedWidth || image.height !== card.expectedHeight) {
        throw new Error(`${card.name} dimensions were ${image.width}x${image.height}, expected ${card.expectedWidth}x${card.expectedHeight}`);
    }

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const sample = ctx.getImageData(0, 0, image.width, image.height).data;
    const colors = new Set<string>();
    let opaqueSamples = 0;

    for (let y = 0; y < image.height; y += 24) {
        for (let x = 0; x < image.width; x += 24) {
            const offset = ((y * image.width) + x) * 4;
            const alpha = sample[offset + 3] ?? 0;
            if (alpha <= 0) continue;

            opaqueSamples += 1;
            const red = sample[offset] ?? 0;
            const green = sample[offset + 1] ?? 0;
            const blue = sample[offset + 2] ?? 0;
            colors.add(`${red >> 4}:${green >> 4}:${blue >> 4}:${alpha >> 4}`);
        }
    }

    if (opaqueSamples < 100) {
        throw new Error(`${card.name} had too few opaque sample pixels: ${opaqueSamples}`);
    }

    if (colors.size < 12) {
        throw new Error(`${card.name} appears blank or nearly blank: ${colors.size} sampled colors`);
    }
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Card renderer smoke check failed: ${message}`);
    process.exit(1);
});
