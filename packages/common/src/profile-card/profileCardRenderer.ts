import { createCanvas, type CanvasRenderingContext2D } from 'canvas';

export const PROFILE_CARD_MIME_TYPE = 'image/png';

export interface ProfileCardInput {
    userId: string;
    displayName: string;
    username?: string | null;
    discriminator?: string | null;
    globalName?: string | null;
    nickname?: string | null;
    guildName?: string | null;
}

export interface ProfileCardRenderOptions {
    width?: number;
    height?: number;
}

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 560;
const FONT_FAMILY = '"Segoe UI", "Noto Sans", Arial, sans-serif';
const TITLE_FONT = `900 56px ${FONT_FAMILY}`;
const SUBTITLE_FONT = `700 30px ${FONT_FAMILY}`;
const META_FONT = `650 24px ${FONT_FAMILY}`;
const SMALL_FONT = `650 20px ${FONT_FAMILY}`;

export function renderProfileCard(input: ProfileCardInput, options: ProfileCardRenderOptions = {}): Buffer {
    const width = normalizeDimension(options.width, DEFAULT_WIDTH);
    const height = normalizeDimension(options.height, DEFAULT_HEIGHT);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    drawBackground(ctx, width, height);
    drawProfileContent(ctx, input, width, height);

    return canvas.toBuffer(PROFILE_CARD_MIME_TYPE);
}

export function buildProfileCardFilename(userId: string): string {
    const safeId = userId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return `profile-card-${safeId || 'user'}.png`;
}

function normalizeDimension(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(320, Math.min(2400, Math.floor(value)));
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#101923');
    gradient.addColorStop(0.52, '#1b2230');
    gradient.addColorStop(1, '#132b2c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#5ff0d0';
    ctx.rotate(-0.08);
    ctx.fillRect(-60, height - 110, width + 120, 46);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ff6d8f';
    ctx.fillRect(width - 240, -90, 120, height + 180);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    roundedRect(ctx, 34, 34, width - 68, height - 68, 30);
    ctx.stroke();
    ctx.restore();
}

function drawProfileContent(ctx: CanvasRenderingContext2D, input: ProfileCardInput, width: number, height: number): void {
    const displayName = normalizeText(input.displayName) || fallbackUserName(input.userId);
    const handle = formatHandle(input.username, input.discriminator);
    const globalName = normalizeText(input.globalName);
    const nickname = normalizeText(input.nickname);
    const guildName = normalizeText(input.guildName);

    ctx.save();
    ctx.fillStyle = 'rgba(3, 9, 15, 0.58)';
    roundedRect(ctx, 68, 74, width - 136, height - 148, 28);
    ctx.fill();
    ctx.restore();

    drawAvatarFallback(ctx, 154, height / 2, 92, displayName);

    const contentX = 290;
    const contentWidth = width - contentX - 100;

    ctx.textBaseline = 'top';
    ctx.font = SMALL_FONT;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.56)';
    ctx.fillText(guildName ? `${guildName} profile` : 'FakeGaming profile', contentX, 122);

    ctx.font = TITLE_FONT;
    ctx.fillStyle = '#f9fbff';
    ctx.fillText(fitText(ctx, displayName, contentWidth), contentX, 162);

    ctx.font = SUBTITLE_FONT;
    ctx.fillStyle = '#5ff0d0';
    ctx.fillText(fitText(ctx, handle ?? fallbackUserName(input.userId), contentWidth), contentX, 236);

    const detailLines = [
        nickname && nickname !== displayName ? `Server nickname: ${nickname}` : null,
        globalName && globalName !== displayName ? `Global name: ${globalName}` : null,
        `Discord ID: ${input.userId}`,
    ].filter((line): line is string => typeof line === 'string' && line.length > 0);

    ctx.font = META_FONT;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    detailLines.forEach((line, index) => {
        ctx.fillText(fitText(ctx, line, contentWidth), contentX, 308 + index * 38);
    });
}

function drawAvatarFallback(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, displayName: string): void {
    const initials = getInitials(displayName);
    const gradient = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    gradient.addColorStop(0, '#5ff0d0');
    gradient.addColorStop(1, '#ff6d8f');

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.stroke();

    ctx.font = `900 64px ${FONT_FAMILY}`;
    ctx.fillStyle = '#081018';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, x, y + 4);
    ctx.restore();
}

function formatHandle(username: string | null | undefined, discriminator: string | null | undefined): string | null {
    const normalizedUsername = normalizeText(username);
    if (!normalizedUsername) return null;
    const normalizedDiscriminator = normalizeText(discriminator);
    if (normalizedDiscriminator && normalizedDiscriminator !== '0') {
        return `@${normalizedUsername}#${normalizedDiscriminator}`;
    }
    return `@${normalizedUsername}`;
}

function normalizeText(value: string | null | undefined): string | null {
    const normalized = value?.replace(/\s+/g, ' ').trim();
    return normalized ? normalized : null;
}

function fallbackUserName(userId: string): string {
    const normalized = userId.trim();
    return normalized ? `Discord user ${normalized.slice(-6)}` : 'Discord user';
}

function getInitials(displayName: string): string {
    const parts = displayName
        .replace(/[^a-z0-9\s_-]/gi, ' ')
        .split(/\s+/)
        .filter(Boolean);
    const first = parts[0]?.[0] ?? '?';
    const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
    return `${first}${second ?? ''}`.toUpperCase();
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
    if (ctx.measureText(value).width <= maxWidth) return value;
    const ellipsis = '...';
    let low = 0;
    let high = value.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const candidate = `${value.slice(0, mid).trimEnd()}${ellipsis}`;
        if (ctx.measureText(candidate).width <= maxWidth) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return `${value.slice(0, low).trimEnd()}${ellipsis}`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
}
