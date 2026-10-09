import { describe, expect, it } from 'vitest';
import { calendarDetailText, googleCalendarEventLink } from '../calendarDetails.js';

describe('calendar provider details', () => {
    it.each([
        'https://www.google.com/calendar/event?eid=synthetic',
        'https://calendar.google.com/calendar/event?eid=synthetic',
        'https://calendar.google.com/calendar/u/0/r/eventedit/synthetic',
    ])('accepts a recognized HTTPS Google event URL: %s', value => {
        expect(googleCalendarEventLink(value)).toBe(value);
    });
    it.each([
        null, '', 'not a URL', 'http://www.google.com/calendar/event?eid=id',
        'https://www.google.com.evil.test/calendar/event?eid=id', 'https://calendar.google.com/redirect?eid=id',
        'https://www.google.com/calendar/event', 'https://www.google.com/calendar/event?eid=',
        'https://user:secret@www.google.com/calendar/event?eid=id', 'https://www.google.com:444/calendar/event?eid=id',
        'https://calendar.google.com/calendar/u/0/r/settings', 'https://www.google.com/calendar/event?eid=%0Aevil',
    ])('omits invalid or unrelated URLs: %s', value => {
        expect(googleCalendarEventLink(value)).toBeNull();
    });
    it('drops unrelated query data and fragment and normalizes descriptions without fetching anything', () => {
        expect(googleCalendarEventLink('https://www.google.com/calendar/event?eid=id&redirect=https://evil.test#secret'))
            .toBe('https://www.google.com/calendar/event?eid=id');
        expect(googleCalendarEventLink(`https://www.google.com/calendar/event?eid=id&ctz=${'漢'.repeat(600)}`)).toBeNull();
        expect(calendarDetailText('<p>First &amp; next</p><div>Second<br>Third</div><style>hidden</style>', 100, true))
            .toBe('First & next\nSecond\nThird');
        expect(calendarDetailText(' @everyone <@123> ', 100)).toBe('@\u200beveryone <@\u200b123>');
        expect(calendarDetailText('<script>hidden</script><br>', 100, true)).toBeNull();
    });
});
