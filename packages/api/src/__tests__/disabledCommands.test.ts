import request from 'supertest';
import app from '../app.js';
import {configManager} from '../jest.setup.js';
import {signTestJwt} from '../testUtils/jwt.js';

const testConfig = {
    guildId: 'testguild1',
    commandName: 'testcommand1'
};

let disabledId: number;

beforeEach(async () => {
    await configManager.disabledCommandManager.remove({});
    const created = await configManager.disabledCommandManager.addPlain(testConfig);
    disabledId = created.id;
});

describe('DisabledCommands API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt();
    });

    it('should list all disabled commands', async () => {
        const res = await request(app).get('/api/disabledCommands').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should check if a command is disabled in a guild', async () => {
        const res = await request(app)
            .get('/api/disabledCommands/check')
            .set('Authorization', `Bearer ${token}`)
            .query({guildId: testConfig.guildId, commandName: testConfig.commandName});
        expect(res.status).toBe(200);
        expect(res.body.disabled).toBe(true);
    });

    it('should add a disabled command', async () => {
        const res = await request(app)
            .post('/api/disabledCommands')
            .set('Authorization', `Bearer ${token}`)
            .send({guildId: 'testguild2', commandName: 'testcommand2'});
        expect(res.status).toBe(201);
        expect(res.body.guildId).toBe('testguild2');
    });

    it('should delete a disabled command by id', async () => {
        const res = await request(app)
            .delete(`/api/disabledCommands/${disabledId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing check params', async () => {
        const res = await request(app)
            .get('/api/disabledCommands/check')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
});