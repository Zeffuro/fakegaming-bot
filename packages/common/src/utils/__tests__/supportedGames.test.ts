import { describe, it, expect } from 'vitest';
import { SUPPORTED_GAMES } from '../supportedGames.js';

describe('SUPPORTED_GAMES', () => {
    it('contains known games', () => {
        expect(SUPPORTED_GAMES.length).toBeGreaterThan(0);
        expect(SUPPORTED_GAMES).toContain('League of Legends');
    });
});
