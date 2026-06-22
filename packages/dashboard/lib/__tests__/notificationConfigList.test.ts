import { describe, expect, it } from 'vitest';
import { getNotificationInfo } from '@/lib/notificationTiming';

describe('NotificationConfigList helpers', () => {
    it('formats configured notification timing constraints', () => {
        expect(getNotificationInfo({
            cooldownMinutes: 15,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:30',
        })).toEqual({
            lines: [
                'Cooldown: 15 minutes',
                'Quiet hours: 22:00 to 07:30',
            ],
        });
    });

    it('omits empty notification timing constraints', () => {
        expect(getNotificationInfo({
            cooldownMinutes: 0,
            quietHoursStart: '',
            quietHoursEnd: '07:30',
        })).toBeUndefined();
    });
});
