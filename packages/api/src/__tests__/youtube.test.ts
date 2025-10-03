import request from 'supertest';
import app from '../app.js';
import {configManager} from '../jest.setup.js';
import {signTestJwt} from '../testUtils/jwt.js';

const testYoutube = {
    youtubeChannelId: 'ytchan1',
    discordChannelId: 'ytchan1discord',
    guildId: 'testguild1'
};

beforeEach(async () => {
    await configManager.youtubeManager.remove({});
    await configManager.youtubeManager.add(testYoutube);
});

describe('YouTube API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all youtube configs', async () => {
        const res = await request(app).get('/api/youtube').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a youtube config by id', async () => {
        const all = await configManager.youtubeManager.getMany({
            youtubeChannelId: testYoutube.youtubeChannelId,
            discordChannelId: testYoutube.discordChannelId
        });
        const id = all[0]?.id;
        expect(id).toBeDefined();
        const res = await request(app).get(`/api/youtube/${id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.youtubeChannelId).toBe(testYoutube.youtubeChannelId);
    });
    it('should add a new youtube config', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).post('/api/youtube').set('Authorization', `Bearer ${token}`).send({
            youtubeChannelId: 'ytchan2',
            discordChannelId: 'ytchan2discord',
            guildId: 'testguild2'
        });
        expect(res.status).toBe(201);
        expect(res.body.youtubeChannelId).toBe('ytchan2');
    });
    it('should upsert a youtube config', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).put('/api/youtube').set('Authorization', `Bearer ${token}`).send({
            youtubeChannelId: 'ytchan1',
            discordChannelId: 'ytchan1discord',
            guildId: 'testguild1'
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('should get a youtube config by channel', async () => {
        const res = await request(app).get('/api/youtube/channel').set('Authorization', `Bearer ${token}`)
            .query({youtubeChannelId: 'ytchan1', discordChannelId: 'ytchan1discord', guildId: 'testguild1'});
        expect(res.status).toBe(200);
        expect(res.body.youtubeChannelId).toBe('ytchan1');
    });
    it('should return 404 for non-existent youtube config', async () => {
        const res = await request(app).get('/api/youtube/999999').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});
