import { describe, it, expect, vi } from 'vitest';
import { computeNextScanDelaySeconds } from '../patchNotesScan.js';

describe('computeNextScanDelaySeconds', () => {
    it('returns within expected jitter range', () => {
        vi.spyOn(Math, 'random').mockReturnValue(1); // +300
        const high = computeNextScanDelaySeconds();
        expect(high).toBe(20*60 + 300);
        vi.spyOn(Math, 'random').mockReturnValue(0); // -300
        const low = computeNextScanDelaySeconds();
        expect(low).toBe(20*60 - 300);
        vi.spyOn(Math, 'random').mockReturnValue(0.5); // 0
        const mid = computeNextScanDelaySeconds();
        expect(mid).toBe(20*60);
    });
});

