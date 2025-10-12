import { describe, it, expect } from 'vitest';
import { createMockCanvasContext2D } from '@zeffuro/fakegaming-common/testing';
import {
    drawRoundedRect,
    drawRoundedRectBorder,
    drawItemSlotBackground,
    applyShadow,
    clearShadow,
    drawCircle,
    drawClippedImage
} from '../canvasExtensions.js';

describe('canvasExtensions', () => {
    describe('drawRoundedRect', () => {
        it('should draw a filled rounded rectangle', () => {
            const ctx = createMockCanvasContext2D();

            drawRoundedRect(ctx as any, 10, 20, 100, 50, 5);

            expect(ctx.beginPath).toHaveBeenCalledTimes(1);
            expect(ctx.moveTo).toHaveBeenCalledWith(15, 20);
            expect(ctx.closePath).toHaveBeenCalledTimes(1);
            expect(ctx.fill).toHaveBeenCalledTimes(1);
            expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(4);
        });

        it('should handle zero radius', () => {
            const ctx = createMockCanvasContext2D();

            drawRoundedRect(ctx as any, 0, 0, 50, 50, 0);

            expect(ctx.beginPath).toHaveBeenCalledTimes(1);
            expect(ctx.fill).toHaveBeenCalledTimes(1);
        });
    });

    describe('drawRoundedRectBorder', () => {
        it('should draw a rounded rectangle border', () => {
            const ctx = createMockCanvasContext2D();

            drawRoundedRectBorder(ctx as any, 10, 20, 100, 50, 5);

            expect(ctx.beginPath).toHaveBeenCalledTimes(1);
            expect(ctx.moveTo).toHaveBeenCalledWith(15, 20);
            expect(ctx.closePath).toHaveBeenCalledTimes(1);
            expect(ctx.stroke).toHaveBeenCalledTimes(1);
            expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(4);
        });

        it('should handle large radius', () => {
            const ctx = createMockCanvasContext2D();

            drawRoundedRectBorder(ctx as any, 5, 5, 200, 100, 20);

            expect(ctx.beginPath).toHaveBeenCalledTimes(1);
            expect(ctx.stroke).toHaveBeenCalledTimes(1);
        });
    });

    describe('drawItemSlotBackground', () => {
        it('should draw item slot with default color', () => {
            const ctx = createMockCanvasContext2D({ fillStyle: '' });

            drawItemSlotBackground(ctx as any, 10, 20, 50, 5);

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.fillStyle).toBe('#222');
            expect(ctx.restore).toHaveBeenCalled();
        });

        it('should draw item slot with custom color', () => {
            const ctx = createMockCanvasContext2D({ fillStyle: '' });

            drawItemSlotBackground(ctx as any, 10, 20, 50, 5, '#ff0000');

            expect(ctx.fillStyle).toBe('#ff0000');
        });
    });

    describe('applyShadow', () => {
        it('should apply shadow effect', () => {
            const ctx = createMockCanvasContext2D({ shadowColor: '', shadowBlur: 0 });

            applyShadow(ctx as any, 'rgba(0,0,0,0.5)', 10);

            expect(ctx.shadowColor).toBe('rgba(0,0,0,0.5)');
            expect(ctx.shadowBlur).toBe(10);
        });
    });

    describe('clearShadow', () => {
        it('should clear shadow effect', () => {
            const ctx = createMockCanvasContext2D({ shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 10 });

            clearShadow(ctx as any);

            expect(ctx.shadowColor).toBe('transparent');
            expect(ctx.shadowBlur).toBe(0);
        });
    });

    describe('drawCircle', () => {
        it('should draw a circle with default alpha', () => {
            const ctx = createMockCanvasContext2D({ fillStyle: '', globalAlpha: 1 });

            drawCircle(ctx as any, 50, 50, 25, '#ff0000');

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.arc).toHaveBeenCalledWith(50, 50, 25, 0, Math.PI * 2);
            expect(ctx.fillStyle).toBe('#ff0000');
            expect(ctx.fill).toHaveBeenCalled();
            expect(ctx.restore).toHaveBeenCalled();
        });

        it('should draw a circle with custom alpha', () => {
            const ctx = createMockCanvasContext2D({ fillStyle: '', globalAlpha: 1 });

            drawCircle(ctx as any, 50, 50, 25, '#ff0000', 0.5);

            expect(ctx.globalAlpha).toBe(1); // Restored to 1 after drawing
        });
    });

    describe('drawClippedImage', () => {
        it('should not draw if image is undefined', () => {
            const ctx = createMockCanvasContext2D();

            drawClippedImage(ctx as any, undefined, 0, 0, 100, 'circle');

            expect(ctx.save).not.toHaveBeenCalled();
        });

        it('should draw circular clipped image', () => {
            const ctx = createMockCanvasContext2D();

            const img = {} as any;

            drawClippedImage(ctx as any, img, 10, 20, 100, 'circle');

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.arc).toHaveBeenCalledWith(60, 70, 50, 0, Math.PI * 2);
            expect(ctx.clip).toHaveBeenCalled();
            expect(ctx.drawImage).toHaveBeenCalledWith(img, 10, 20, 100, 100);
            expect(ctx.restore).toHaveBeenCalled();
        });

        it('should draw rounded rectangle clipped image', () => {
            const ctx = createMockCanvasContext2D();

            const img = {} as any;

            drawClippedImage(ctx as any, img, 10, 20, 100, 'rounded', 8);

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.clip).toHaveBeenCalled();
            expect(ctx.drawImage).toHaveBeenCalledWith(img, 10, 20, 100, 100);
            expect(ctx.restore).toHaveBeenCalled();
        });
    });
});
