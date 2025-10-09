import { describe, it, expect } from 'vitest';
import { queueMapper, rankedTypeMapper, gameModeConvertMap } from '../leagueMappers.js';

describe('leagueMappers', () => {
    describe('queueMapper', () => {
        it('should map queue IDs to queue names', () => {
            expect(queueMapper[420]).toBe('Ranked Solo');
            expect(queueMapper[440]).toBe('Ranked Flex');
            expect(queueMapper[450]).toBe('ARAM');
            expect(queueMapper[1700]).toBe('Arena');
        });

        it('should have all expected queue types', () => {
            expect(queueMapper[400]).toBe('Draft Pick');
            expect(queueMapper[430]).toBe('Blind Pick');
            expect(queueMapper[700]).toBe('Clash');
            expect(queueMapper[900]).toBe('URF');
            expect(queueMapper[1020]).toBe('One for All');
            expect(queueMapper[1300]).toBe('Nexus Blitz');
        });

        it('should map co-op vs AI queues', () => {
            expect(queueMapper[830]).toBe('Co-op vs. AI Intro');
            expect(queueMapper[840]).toBe('Co-op vs. AI Beginner');
            expect(queueMapper[850]).toBe('Co-op vs. AI Intermediate');
        });

        it('should map tutorial queues', () => {
            expect(queueMapper[2000]).toBe('Tutorial 1');
            expect(queueMapper[2010]).toBe('Tutorial 2');
            expect(queueMapper[2020]).toBe('Tutorial 3');
        });
    });

    describe('rankedTypeMapper', () => {
        it('should map ranked types to display names', () => {
            expect(rankedTypeMapper['RANKED_SOLO_5x5']).toBe('Ranked Solo');
            expect(rankedTypeMapper['RANKED_FLEX_SR']).toBe('Ranked Flex');
            expect(rankedTypeMapper['RANKED_FLEX_TT']).toBe('Ranked Flex TT');
            expect(rankedTypeMapper['RANKED_TFT']).toBe('Ranked TFT');
        });

        it('should have exactly 4 ranked types', () => {
            expect(Object.keys(rankedTypeMapper)).toHaveLength(4);
        });
    });

    describe('gameModeConvertMap', () => {
        it('should map game modes to display names', () => {
            expect(gameModeConvertMap['CLASSIC']).toBe('Summoner\'s Rift');
            expect(gameModeConvertMap['ARAM']).toBe('ARAM');
            expect(gameModeConvertMap['CHERRY']).toBe('Arena');
            expect(gameModeConvertMap['URF']).toBe('AR Ultra Rapid Fire');
        });

        it('should map special game modes', () => {
            expect(gameModeConvertMap['ONEFORALL']).toBe('One for All');
            expect(gameModeConvertMap['NEXUSBLITZ']).toBe('Nexus Blitz');
            expect(gameModeConvertMap['ULTBOOK']).toBe('Ultimate Spellbook');
            expect(gameModeConvertMap['KINGPORO']).toBe('Legend of the Poro King');
        });

        it('should map legacy game modes', () => {
            expect(gameModeConvertMap['FIRSTBLOOD']).toBe('Snowdown Showdown');
            expect(gameModeConvertMap['ASCENSION']).toBe('Ascension');
            expect(gameModeConvertMap['SIEGE']).toBe('Nexus Siege');
            expect(gameModeConvertMap['ODYSSEY']).toBe('Odyssey');
        });

        it('should map tutorial mode', () => {
            expect(gameModeConvertMap['TUTORIAL']).toBe('Tutorial');
        });
    });
});
