import {CanvasRenderingContext2D, Image} from 'canvas';

export function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

export function drawRoundedRectBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();
}

export function drawItemSlotBackground(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, radius: number, color: string = '#222') {
    ctx.save();
    ctx.fillStyle = color;
    drawRoundedRect(ctx, x, y, size, size, radius);
    ctx.restore();
}

export function applyShadow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
}

export function clearShadow(ctx: CanvasRenderingContext2D) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}

export function drawClippedImage(ctx: CanvasRenderingContext2D, img: Image | undefined, x: number, y: number, size: number, shape: 'circle' | 'rounded', radius: number = 4) {
    if (!img) return;
    ctx.save();
    if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
    } else {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + size - radius, y);
        ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
        ctx.lineTo(x + size, y + size - radius);
        ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
        ctx.lineTo(x + radius, y + size);
        ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.clip();
    }
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
}

export function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
}

export async function drawVerticalList<T>(ctx: CanvasRenderingContext2D, items: T[], startX: number, startY: number, gap: number, render: (item: T, x: number, y: number, index: number) => void | Promise<void>) {
    let y = startY;
    for (let i = 0; i < items.length; i++) {
        await render(items[i], startX, y, i);
        y += gap;
    }
}

export async function drawHorizontalList<T>(ctx: CanvasRenderingContext2D, items: T[], startX: number, startY: number, gap: number, render: (item: T, x: number, y: number, index: number) => void | Promise<void>) {
    let x = startX;
    for (let i = 0; i < items.length; i++) {
        await render(items[i], x, startY, i);
        x += gap;
    }
}

export async function drawGridList<T>(ctx: CanvasRenderingContext2D, items: T[], startX: number, startY: number, columns: number, cellWidth: number, cellHeight: number, render: (item: T, x: number, y: number, index: number) => void | Promise<void>) {
    for (let i = 0; i < items.length; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = startX + col * cellWidth;
        const y = startY + row * cellHeight;
        await render(items[i], x, y, i);
    }
}

export function drawRoundedBoxLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, options?: {
    font?: string,
    textColor?: string,
    bgColor?: string,
    paddingX?: number,
    paddingY?: number,
    borderRadius?: number
}) {
    const font = options?.font || 'bold 16px "Roboto", Arial';
    const textColor = options?.textColor || '#fff';
    const bgColor = options?.bgColor || '#c0392b';
    const paddingX = options?.paddingX ?? 14;
    const paddingY = options?.paddingY ?? 4;
    const borderRadius = options?.borderRadius ?? 12;
    ctx.save();
    ctx.font = font;
    const labelWidth = ctx.measureText(label).width + paddingX * 2;
    const labelHeight = parseInt(font.match(/\d+/)?.[0] || '16', 10) + paddingY * 2;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = bgColor;
    drawRoundedRect(ctx, x, y, labelWidth, labelHeight, borderRadius);
    ctx.globalAlpha = 1;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    ctx.fillText(label, x + labelWidth / 2, y + labelHeight / 2);
    ctx.restore();
    return {width: labelWidth, height: labelHeight};
}
