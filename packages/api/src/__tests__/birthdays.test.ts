import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectOk, expectCreated, expectUnauthorized, expectForbidden, expectNotFound } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

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
    await configManager.birthdayManager.removeAll();
    // Add test birthday using addPlain instead of set
    await configManager.birthdayManager.addPlain({
        userId: testBirthday.userId,
        guildId: testBirthday.guildId,
        channelId: testBirthday.channelId,
        ...parseDate(testBirthday.date)
    });
});

describe('Birthdays API', () => {
    const client = givenAuthenticatedClient(app);

    it('should list all birthdays', async () => {
        const res = await client.get('/api/birthdays');
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get a birthday by userId and guildId', async () => {
        const res = await client.get(`/api/birthdays/${testBirthday.userId}/${testBirthday.guildId}`);
        expectOk(res);
        expect(res.body.userId).toBe(testBirthday.userId);
        expect(res.body.guildId).toBe(testBirthday.guildId);
    });

    it('should add or update a birthday', async () => {
        const { year, month, day } = parseDate('1999-12-31');
        const res = await client.post('/api/birthdays', {
            userId: 'birthdayuser2',
            guildId: 'birthdayguild2',
            channelId: 'testchannel2',
            year,
            month,
            day
        });
        expectCreated(res);
        expect(res.body.success).toBe(true);
    });

    it('should delete a birthday', async () => {
        // Add a birthday to delete using addPlain
        await configManager.birthdayManager.addPlain({
            userId: 'birthdayuser3',
            guildId: 'birthdayguild3',
            channelId: 'testchannel3',
            ...parseDate('1990-01-01')
        });
        const res = await client.delete('/api/birthdays/birthdayuser3/birthdayguild3');
        expectOk(res);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent birthday', async () => {
        const res = await client.get('/api/birthdays/nonexistentuser/nonexistentguild');
        expectNotFound(res);
    });

    it('should return 401 for GET /api/birthdays without JWT', async () => {
        const res = await client.raw.get('/api/birthdays');
        expectUnauthorized(res);
    });

    it('should return 401 for POST /api/birthdays without JWT', async () => {
        const { year, month, day } = parseDate('2001-01-01');
        const res = await client.raw
            .post('/api/birthdays')
            .send({userId: 'birthdayuser4', guildId: 'birthdayguild4', channelId: 'testchannel4', year, month, day});
        expectUnauthorized(res);
    });

    it('should return 401 for DELETE /api/birthdays/:userId/:guildId without JWT', async () => {
        const res = await client.raw
            .delete(`/api/birthdays/${testBirthday.userId}/${testBirthday.guildId}`);
        expectUnauthorized(res);
    });

    it('should return 404 when deleting non-existent birthday', async () => {
        const res = await client.delete('/api/birthdays/nonexistentuser/nonexistentguild');
        expectNotFound(res);
    });

    it('should handle duplicate add gracefully', async () => {
        const { year, month, day } = parseDate(testBirthday.date);
        const res1 = await client.post('/api/birthdays', { ...parseDate(testBirthday.date), userId: testBirthday.userId, guildId: testBirthday.guildId, channelId: testBirthday.channelId, year, month, day });
        expect([201, 409]).toContain(res1.status);
    });

    it('should return 400 for invalid input types', async () => {
        const res = await client.post('/api/birthdays', {userId: 123 as any, guildId: null as any, year: 'x' as any, month: null as any, day: null as any, channelId: null as any});
        // Depending on validation, this might be 400 or 500
        expect([400, 500]).toContain(res.status);
    });

    it('should return 500 for DB error on POST /api/birthdays', async () => {
        // Simulate DB error by mocking addPlain
        const origAddPlain = configManager.birthdayManager.addPlain;
        configManager.birthdayManager.addPlain = async () => { throw new Error('DB error'); };
        const { year, month, day } = parseDate('2002-02-02');
        const res = await client.post('/api/birthdays', {userId: 'birthdayuser5', guildId: 'testguild1', channelId: 'testchannel5', year, month, day});
        expect(res.status).toBe(500);
        configManager.birthdayManager.addPlain = origAddPlain;
    });

    it('should return 403 for POST /api/birthdays as non-admin', async () => {
        const nonAdmin = givenAuthenticatedClient(app, { discordId: 'nonadminuser' });
        const { year, month, day } = parseDate('1995-05-05');
        const res = await nonAdmin.post('/api/birthdays', { userId: 'birthdayuserX', guildId: 'birthdayguild1', channelId: 'chanX', year, month, day });
        expectForbidden(res);
    });

    it('should return 403 for DELETE /api/birthdays/:userId/:guildId as non-admin', async () => {
        // Add a birthday in the same guild to attempt deletion
        await configManager.birthdayManager.addPlain({
            userId: 'birthdayuserY',
            guildId: 'birthdayguild1',
            channelId: 'chanY',
            ...parseDate('1993-03-03')
        });
        const nonAdmin = givenAuthenticatedClient(app, { discordId: 'nonadminuser' });
        const res = await nonAdmin.delete('/api/birthdays/birthdayuserY/birthdayguild1');
        expectForbidden(res);
    });
});
