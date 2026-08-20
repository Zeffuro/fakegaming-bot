import { describe, expect, it } from 'vitest';
import calendar from '../commands/calendar.js';
import help from '../commands/help.js';
import permissionsBackup from '../commands/permissionsBackup.js';
import poll from '../commands/poll.js';
import profileCard from '../commands/profileCard.js';
import question from '../commands/question.js';
import roll from '../commands/roll.js';
import spin from '../commands/spin.js';
import testNotification from '../commands/testNotification.js';
import time from '../commands/time.js';
import weather from '../commands/weather.js';

interface LocalizedNode {
    name: string;
    description?: string;
    name_localizations?: Record<string, string> | null;
    description_localizations?: Record<string, string> | null;
    options?: LocalizedNode[];
    choices?: Array<{ name_localizations?: Record<string, string> | null }>;
}

const commands = [calendar, help, permissionsBackup, poll, profileCard, question, roll, spin, testNotification, time, weather];

describe('general command localization metadata', () => {
    it('provides Dutch names and descriptions for every command and option', () => {
        for (const command of commands) {
            assertLocalized(command.data.toJSON() as LocalizedNode);
        }
    });
});

function assertLocalized(node: LocalizedNode): void {
    expect(node.name_localizations?.nl, `${node.name} Dutch name`).toBeTruthy();
    if (node.description !== undefined) {
        expect(node.description_localizations?.nl, `${node.name} Dutch description`).toBeTruthy();
    }
    for (const choice of node.choices ?? []) {
        expect(choice.name_localizations?.nl, `${node.name} choice Dutch name`).toBeTruthy();
    }
    for (const option of node.options ?? []) assertLocalized(option);
}
