import request from 'supertest';
import app from '../app.js';
import {configManager} from '../jest.setup.js';

const testTwitch = {
    twitchUsername: 'teststreamer',
    discordChannelId: 'testchannel1'
};

beforeEach(async () => {
    // Clean up twitch table before each test
    await configManager.twitchManager.remove({});
    await configManager.twitchManager.add(testTwitch);
});

describe('Twitch API', () => {
    it('should list all twitch configs', async () => {
        const res = await request(app).get('/api/twitch');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get a twitch config by id', async () => {
        // Find the id of the inserted config
        const all = await configManager.twitchManager.getMany({
            twitchUsername: testTwitch.twitchUsername,
            discordChannelId: testTwitch.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await request(app).get(`/api/twitch/${id}`);
        expect(res.status).toBe(200);
        expect(res.body.twitchUsername).toBe(testTwitch.twitchUsername);
    });

    it('should add a new twitch config', async () => {
        const res = await request(app).post('/api/twitch').send({
            twitchUsername: 'anotherstreamer',
            discordChannelId: 'testchannel2'
        });
        expect(res.status).toBe(201);
        expect(res.body.twitchUsername).toBe('anotherstreamer');
    });

    it('should check if a stream exists', async () => {
        const res = await request(app).get('/api/twitch/exists')
            .query({username: testTwitch.twitchUsername, channelId: testTwitch.discordChannelId});
        expect(res.status).toBe(200);
        expect(res.body.exists).toBe(true);
    });

    it('should return false for non-existent stream', async () => {
        const res = await request(app).get('/api/twitch/exists')
            .query({username: 'nonexistent', channelId: 'nonexistent'});
        expect(res.status).toBe(200);
        expect(res.body.exists).toBe(false);
    });

    it('should return 404 for non-existent twitch config', async () => {
        const res = await request(app).get('/api/twitch/999999');
        expect(res.status).toBe(404);
    });
});
