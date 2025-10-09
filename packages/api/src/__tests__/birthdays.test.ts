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
        const { year, month, day } = parseDate('1999-12-31');
        const res = await request(app).post('/api/birthdays').set('Authorization', `Bearer ${token}`).send({
            userId: 'birthdayuser2',
            guildId: 'birthdayguild2',
            channelId: 'testchannel2',
            year,
            month,
            day
        });
        expect(res.status).toBe(201);
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
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).delete('/api/birthdays/birthdayuser3/birthdayguild3').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent birthday', async () => {
        const res = await request(app).get('/api/birthdays/nonexistentuser/nonexistentguild').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should return 401 for GET /api/birthdays without JWT', async () => {
        const res = await request(app).get('/api/birthdays');
        expect(res.status).toBe(401);
    });

    it('should return 401 for POST /api/birthdays without JWT', async () => {
        const { year, month, day } = parseDate('2001-01-01');
        const res = await request(app)
            .post('/api/birthdays')
            .send({userId: 'birthdayuser4', guildId: 'birthdayguild4', channelId: 'testchannel4', year, month, day});
        expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /api/birthdays/:userId/:guildId without JWT', async () => {
        const res = await request(app)
            .delete(`/api/birthdays/${testBirthday.userId}/${testBirthday.guildId}`);
        expect(res.status).toBe(401);
    });

    it('should return 404 when deleting non-existent birthday', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .delete('/api/birthdays/nonexistentuser/nonexistentguild')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('should handle duplicate add gracefully', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const { year, month, day } = parseDate(testBirthday.date);
        const res1 = await request(app)
            .post('/api/birthdays')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...parseDate(testBirthday.date), userId: testBirthday.userId, guildId: testBirthday.guildId, channelId: testBirthday.channelId, year, month, day });
        expect([201, 409]).toContain(res1.status);
    });

    it('should return 400 for invalid input types', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .post('/api/birthdays')
            .set('Authorization', `Bearer ${token}`)
            .send({userId: 123, guildId: null, year: 'x', month: null, day: null, channelId: null});
        expect([400, 500]).toContain(res.status);
    });

    it('should return 500 for DB error on POST /api/birthdays', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Simulate DB error by mocking addPlain
        const origAddPlain = configManager.birthdayManager.addPlain;
        configManager.birthdayManager.addPlain = async () => { throw new Error('DB error'); };
        const { year, month, day } = parseDate('2002-02-02');
        const res = await request(app)
            .post('/api/birthdays')
            .set('Authorization', `Bearer ${token}`)
            .send({userId: 'birthdayuser5', guildId: 'testguild1', channelId: 'testchannel5', year, month, day});
        expect(res.status).toBe(500);
        configManager.birthdayManager.addPlain = origAddPlain;
    });

    it('should return 403 for POST /api/birthdays as non-admin', async () => {
        const nonAdminToken = signTestJwt({ discordId: 'nonadminuser' });
        const { year, month, day } = parseDate('1995-05-05');
        const res = await request(app)
            .post('/api/birthdays')
            .set('Authorization', `Bearer ${nonAdminToken}`)
            .send({ userId: 'birthdayuserX', guildId: 'birthdayguild1', channelId: 'chanX', year, month, day });
        expect(res.status).toBe(403);
    });

    it('should return 403 for DELETE /api/birthdays/:userId/:guildId as non-admin', async () => {
        // Add a birthday in the same guild to attempt deletion
        await configManager.birthdayManager.addPlain({
            userId: 'birthdayuserY',
            guildId: 'birthdayguild1',
            channelId: 'chanY',
            ...parseDate('1993-03-03')
        });
        const nonAdminToken = signTestJwt({ discordId: 'nonadminuser' });
        const res = await request(app)
            .delete('/api/birthdays/birthdayuserY/birthdayguild1')
            .set('Authorization', `Bearer ${nonAdminToken}`);
        expect(res.status).toBe(403);
    });
});
