import { describe, expect, it } from 'vitest';
import leagueForm from '../commands/leagueForm.js';
import leagueHistory from '../commands/leagueHistory.js';
import leagueStats from '../commands/leagueStats.js';
import linkRiot from '../commands/linkRiot.js';
import riotLinks from '../commands/riotLinks.js';
import tftHistory from '../commands/tftHistory.js';
import tftStats from '../commands/tftStats.js';
import { formatDuration, timeAgo } from '../../../utils/generalUtils.js';

interface LocalizedNode {
    name: string;
    description?: string;
    name_localizations?: Record<string, string> | null;
    description_localizations?: Record<string, string> | null;
    options?: LocalizedNode[];
    choices?: Array<{ name_localizations?: Record<string, string> | null }>;
}

function assertLocalized(node: LocalizedNode): void {
    expect(node.name_localizations?.nl, `${node.name} Dutch name`).toBeTruthy();
    if (node.description !== undefined) {
        expect(node.description_localizations?.nl, `${node.name} Dutch description`).toBeTruthy();
    }
    for (const choice of node.choices ?? []) expect(choice.name_localizations?.nl).toBeTruthy();
    for (const option of node.options ?? []) assertLocalized(option);
}

describe('League command localization', () => {
    it('provides Dutch metadata throughout every command tree', () => {
        for (const command of [leagueForm, leagueHistory, leagueStats, linkRiot, riotLinks, tftHistory, tftStats]) {
            assertLocalized(command.data.toJSON() as LocalizedNode);
        }
    });

    it('formats image time labels in both supported locales', () => {
        expect(timeAgo(0, 3_600_000)).toBe('1 hour ago');
        expect(timeAgo(0, 3_600_000, 'nl')).toBe('1 uur geleden');
        expect(formatDuration(125)).toBe('2m 05s');
        expect(formatDuration(125, 'nl')).toBe('2 min. 05 sec.');
    });
});
