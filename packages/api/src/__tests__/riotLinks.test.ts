import '../vitest.setup.js';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { expectForbidden, expectNotFound, expectOk } from '@zeffuro/fakegaming-common/testing';
import request from 'supertest';
import { createHmac } from 'node:crypto';

const ORIGINAL_ADMINS = process.env.DASHBOARD_ADMINS;
const ORIGINAL_SERVICE_TOKEN = process.env.SERVICE_API_TOKEN;

describe('Riot links admin routes', () => {
    const admin = givenAuthenticatedClient(app, { discordId: 'admin-user' });
    const nonAdmin = givenAuthenticatedClient(app, { discordId: 'regular-user' });

    beforeEach(async () => {
        process.env.DASHBOARD_ADMINS = 'admin-user';
        process.env.SERVICE_API_TOKEN = 'service-token';
        const leagueManager = getConfigManager().leagueManager;
        vi.spyOn(leagueManager, 'getLinkedAccountsPlain').mockResolvedValue([
            {
                discordId: 'discord-1',
                summonerName: 'Linked#EUW',
                region: 'euw1',
                puuid: 'puuid-1',
            } as never,
        ]);
        vi.spyOn(leagueManager, 'getLinkedAccountPlain').mockImplementation(async (discordId: string) => {
            if (discordId !== 'discord-1') return null;
            return {
                discordId: 'discord-1',
                summonerName: 'Linked#EUW',
                region: 'euw1',
                puuid: 'puuid-1',
            } as never;
        });
        vi.spyOn(leagueManager, 'setLinkedAccount').mockImplementation(async (account) => ({
            get: () => account,
        }) as never);
        vi.spyOn(leagueManager, 'removeLinkedAccount').mockResolvedValue(1);
    });

    afterAll(() => {
        process.env.DASHBOARD_ADMINS = ORIGINAL_ADMINS;
        process.env.SERVICE_API_TOKEN = ORIGINAL_SERVICE_TOKEN;
    });

    it('lists linked Riot accounts for dashboard admins', async () => {
        const res = await admin.get('/api/riotLinks');

        expectOk(res);
        expect(res.body.links).toHaveLength(1);
        expect(res.body.links[0]).toMatchObject({
            discordId: 'discord-1',
            summonerName: 'Linked#EUW',
            region: 'euw1',
            puuid: 'puuid-1',
        });
    });

    it('blocks non-dashboard admins', async () => {
        const res = await nonAdmin.get('/api/riotLinks');

        expectForbidden(res);
        expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('allows a service-authenticated dashboard admin assertion', async () => {
        const reqId = 'dashboard-service-request-1';
        const signature = createHmac('sha256', process.env.JWT_SECRET!)
            .update(`admin-user:${reqId}`)
            .digest('hex');

        const res = await request(app)
            .get('/api/riotLinks')
            .set('x-service-token', 'service-token')
            .set('x-dashboard-admin-user', 'admin-user')
            .set('x-dashboard-admin-request', reqId)
            .set('x-dashboard-admin-signature', signature);

        expectOk(res);
        expect(res.body.links).toHaveLength(1);
    });

    it('allows a signed service dashboard admin assertion from the dashboard proxy', async () => {
        const reqId = 'dashboard-request-1';
        const signature = createHmac('sha256', process.env.JWT_SECRET!)
            .update(`admin-user:${reqId}`)
            .digest('hex');

        const res = await request(app)
            .get('/api/riotLinks')
            .set('x-service-token', 'service-token')
            .set('x-request-id', reqId)
            .set('x-dashboard-admin-user', 'admin-user')
            .set('x-dashboard-admin-request', reqId)
            .set('x-dashboard-admin-signature', signature);

        expectOk(res);
        expect(res.body.links).toHaveLength(1);
    });

    it('does not trust a dashboard admin assertion without service authentication', async () => {
        const res = await nonAdmin.raw
            .get('/api/riotLinks')
            .set('Authorization', `Bearer ${nonAdmin.token}`)
            .set('x-dashboard-admin-user', 'admin-user');

        expectForbidden(res);
    });

    it('does not trust an invalid dashboard admin signature', async () => {
        const res = await nonAdmin.raw
            .get('/api/riotLinks')
            .set('Authorization', `Bearer ${nonAdmin.token}`)
            .set('x-request-id', 'dashboard-request-2')
            .set('x-dashboard-admin-user', 'admin-user')
            .set('x-dashboard-admin-request', 'dashboard-request-2')
            .set('x-dashboard-admin-signature', '00'.repeat(32));

        expectForbidden(res);
    });

    it('updates a linked Riot account', async () => {
        const res = await admin.put('/api/riotLinks/discord-1', {
            summonerName: 'Updated#NA1',
            region: 'na1',
            puuid: 'puuid-2',
        });

        expectOk(res);
        expect(res.body).toMatchObject({
            discordId: 'discord-1',
            summonerName: 'Updated#NA1',
            region: 'na1',
            puuid: 'puuid-2',
        });
    });

    it('upserts a new linked Riot account', async () => {
        const setLinkedAccount = vi.mocked(getConfigManager().leagueManager.setLinkedAccount);
        const res = await admin.put('/api/riotLinks/discord-2', {
            summonerName: 'New#EUW',
            region: 'euw1',
            puuid: 'puuid-new',
        });

        expectOk(res);
        expect(res.body.discordId).toBe('discord-2');
        expect(setLinkedAccount).toHaveBeenCalledWith({
            discordId: 'discord-2',
            summonerName: 'New#EUW',
            region: 'euw1',
            puuid: 'puuid-new',
        });
    });

    it('returns 404 for missing links and deletes existing links', async () => {
        const removeLinkedAccount = vi.mocked(getConfigManager().leagueManager.removeLinkedAccount);
        const missing = await admin.get('/api/riotLinks/missing-user');
        expectNotFound(missing);

        const deleted = await admin.delete('/api/riotLinks/discord-1');
        expectOk(deleted);
        expect(deleted.body.success).toBe(true);
        expect(removeLinkedAccount).toHaveBeenCalledWith('discord-1');
    });
});
