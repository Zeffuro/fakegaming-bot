import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';

const testBirthday = {
    userId: 'birthdayuser1',
    guildId: 'birthdayguild1',
    date: '2000-01-01',
    channelId: 'testchannel1'
};

const parseDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return {year, month, day};
};

beforeEach(async () => {
    // Clean up birthdays table before each test
    await configManager.birthdayManager.remove({});
    // Only pass userId and guildId to set, then update date
    await configManager.birthdayManager.set({
        userId: testBirthday.userId,
        guildId: testBirthday.guildId,
        channelId: testBirthday.channelId,
        ...parseDate(testBirthday.date)
    }, 'userId');
    await configManager.birthdayManager.update({date: testBirthday.date, channelId: testBirthday.channelId}, {
        userId: testBirthday.userId,
        guildId: testBirthday.guildId
    });
});

describe('Birthdays API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all birthdays', async () => {
        const res = await request(app).get('/api/birthdays').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a birthday by userId and guildId', async () => {
        const res = await request(app).get(`/api/birthdays/${testBirthday.userId}/${testBirthday.guildId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.userId).toBe(testBirthday.userId);
        expect(res.body.guildId).toBe(testBirthday.guildId);
    });
    it('should add or update a birthday', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).post('/api/birthdays').set('Authorization', `Bearer ${token}`).send({
            userId: 'birthdayuser2',
            guildId: 'birthdayguild2',
            date: '1999-12-31',
            channelId: 'testchannel2'
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('should delete a birthday', async () => {
        // Add a birthday to delete
        await configManager.birthdayManager.set({
            userId: 'birthdayuser3',
            guildId: 'birthdayguild3',
            channelId: 'testchannel3',
            ...parseDate('1990-01-01')
        }, 'userId');
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).delete('/api/birthdays/birthdayuser3/birthdayguild3').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent birthday', async () => {
        const res = await request(app).get('/api/birthdays/nonexistentuser/nonexistentguild').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});
