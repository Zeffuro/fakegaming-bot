import { describe, expect, it } from 'vitest';
import birthday from '../../birthdays/commands/birthday.js';
import birthdays from '../../birthdays/commands/birthdays.js';
import removeBirthday from '../../birthdays/commands/removeBirthday.js';
import setBirthday from '../../birthdays/commands/setBirthday.js';
import showBirthday from '../../birthdays/commands/showBirthday.js';
import notes from '../../notes/commands/notes.js';
import saveMessageToNotes from '../../notes/commands/saveMessageToNotes.js';
import deleteReminder from '../commands/deleteReminder.js';
import pauseReminder from '../commands/pauseReminder.js';
import reminders from '../commands/reminders.js';
import remindMeInOneHour from '../commands/remindMeInOneHour.js';
import resumeReminder from '../commands/resumeReminder.js';
import setReminder from '../commands/setReminder.js';
import setTimezone from '../commands/setTimezone.js';
import snoozeReminder from '../commands/snoozeReminder.js';

interface LocalizedNode {
    name: string;
    description?: string;
    name_localizations?: Record<string, string> | null;
    description_localizations?: Record<string, string> | null;
    options?: LocalizedNode[];
    choices?: Array<{ name_localizations?: Record<string, string> | null }>;
}

const commands = [
    birthday, birthdays, removeBirthday, setBirthday, showBirthday,
    notes, saveMessageToNotes,
    deleteReminder, pauseReminder, reminders, remindMeInOneHour,
    resumeReminder, setReminder, setTimezone, snoozeReminder,
];

describe('personal command localization metadata', () => {
    it('provides Dutch names and descriptions throughout command trees', () => {
        for (const command of commands) assertLocalized(command.data.toJSON() as LocalizedNode);
    });
});

function assertLocalized(node: LocalizedNode): void {
    expect(node.name_localizations?.nl, `${node.name} Dutch name`).toBeTruthy();
    if (node.description !== undefined) {
        expect(node.description_localizations?.nl, `${node.name} Dutch description`).toBeTruthy();
    }
    for (const choice of node.choices ?? []) expect(choice.name_localizations?.nl).toBeTruthy();
    for (const option of node.options ?? []) assertLocalized(option);
}
