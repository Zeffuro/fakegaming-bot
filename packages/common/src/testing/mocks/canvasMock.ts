// filepath: packages/common/src/testing/mocks/canvasMock.ts
import { vi } from 'vitest';

export interface MockCanvasContext2D {
    // drawing state
    fillStyle: string;
    strokeStyle: string;
    shadowColor: string;
    shadowBlur: number;
    globalAlpha: number;
    // path ops
    beginPath: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    quadraticCurveTo: ReturnType<typeof vi.fn>;
    closePath: ReturnType<typeof vi.fn>;
    arc: ReturnType<typeof vi.fn>;
    // draw ops
    fill: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
    clip: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    // save/restore
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock CanvasRenderingContext2D-like object with spies for common methods
 */
export function createMockCanvasContext2D(overrides: Partial<MockCanvasContext2D> = {}): MockCanvasContext2D {
    const ctx: MockCanvasContext2D = {
        fillStyle: '#000',
        strokeStyle: '#000',
        shadowColor: 'transparent',
        shadowBlur: 0,
        globalAlpha: 1,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        clip: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        ...overrides
    };

    return ctx;
}

export type { MockCanvasContext2D as Canvas2DMock };

