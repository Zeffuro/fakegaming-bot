import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { BirthdayConfig } from '../../models/birthday-config.js';

describe('BaseManager', () => {
    const birthdayManager = configManager.birthdayManager;

    beforeEach(async () => {
        await birthdayManager.remove({});
    });

    describe('getAll', () => {
        it('should return all records', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            await BirthdayConfig.create({
                userId: 'user-2',
                day: 2,
                month: 2,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const results = await birthdayManager.getAll();
            expect(results).toHaveLength(2);
        });

        it('should return empty array when no records exist', async () => {
            const results = await birthdayManager.getAll();
            expect(results).toEqual([]);
        });
    });

    describe('getAllPlain', () => {
        it('should return all records as plain objects', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const results = await birthdayManager.getAllPlain();
            expect(results).toHaveLength(1);
            expect(results[0]).toHaveProperty('userId', 'user-1');
        });
    });

    describe('set', () => {
        it('should create a new record', async () => {
            const [record, created] = await birthdayManager.set({
                userId: 'user-new',
                day: 15,
                month: 6,
                guildId: 'guild-new',
                channelId: 'channel-new',
            }, 'userId');

            expect(created).toBe(true);
            expect(record.userId).toBe('user-new');
        });

        it('should update an existing record', async () => {
            await BirthdayConfig.create({
                userId: 'user-update',
                day: 10,
                month: 5,
                guildId: 'guild-1',
                channelId: 'channel-old',
            });

            const [record, created] = await birthdayManager.set({
                userId: 'user-update',
                day: 20,
                month: 5,
                guildId: 'guild-1',
                channelId: 'channel-new',
            }, 'userId');

            expect(created).toBe(false);
            expect(record.channelId).toBe('channel-new');
            expect(record.day).toBe(20);
        });
    });

    describe('getOne', () => {
        it('should return a single record', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const result = await birthdayManager.getOne({ userId: 'user-1' });
            expect(result).not.toBeNull();
            expect(result?.userId).toBe('user-1');
        });

        it('should return null when record not found', async () => {
            const result = await birthdayManager.getOne({ userId: 'non-existent' });
            expect(result).toBeNull();
        });
    });

    describe('getOnePlain', () => {
        it('should return a single record as plain object', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const result = await birthdayManager.getOnePlain({ userId: 'user-1' });
            expect(result).not.toBeNull();
            expect(result).toHaveProperty('userId', 'user-1');
        });
    });

    describe('getMany', () => {
        it('should return multiple records matching criteria', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            await BirthdayConfig.create({
                userId: 'user-2',
                day: 2,
                month: 2,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            await BirthdayConfig.create({
                userId: 'user-3',
                day: 3,
                month: 3,
                guildId: 'guild-2',
                channelId: 'channel-2',
            });

            const results = await birthdayManager.getMany({ guildId: 'guild-1' });
            expect(results).toHaveLength(2);
            expect(results.every(r => r.guildId === 'guild-1')).toBe(true);
        });
    });

    describe('getManyPlain', () => {
        it('should return multiple records as plain objects', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const results = await birthdayManager.getManyPlain({ guildId: 'guild-1' });
            expect(results).toHaveLength(1);
            expect(results[0]).toHaveProperty('userId', 'user-1');
        });
    });

    describe('add', () => {
        it('should add a new record', async () => {
            const record = await birthdayManager.add({
                userId: 'user-add',
                day: 15,
                month: 6,
                guildId: 'guild-add',
                channelId: 'channel-add',
            });

            expect(record.userId).toBe('user-add');
        });
    });

    describe('addPlain', () => {
        it('should add a new record and return as plain object', async () => {
            const record = await birthdayManager.addPlain({
                userId: 'user-add-plain',
                day: 15,
                month: 6,
                guildId: 'guild-add',
                channelId: 'channel-add',
            });

            expect(record).toHaveProperty('userId', 'user-add-plain');
        });
    });

    describe('upsert', () => {
        it('should create a new record', async () => {
            const created = await birthdayManager.upsert({
                userId: 'user-upsert',
                day: 15,
                month: 6,
                guildId: 'guild-upsert',
                channelId: 'channel-upsert',
            });

            expect(created).toBe(true);
        });

        it('should update an existing record', async () => {
            await BirthdayConfig.create({
                userId: 'user-upsert-2',
                day: 10,
                month: 5,
                guildId: 'guild-1',
                channelId: 'channel-old',
            });

            const created = await birthdayManager.upsert({
                userId: 'user-upsert-2',
                day: 20,
                month: 5,
                guildId: 'guild-1',
                channelId: 'channel-new',
            });

            expect(created).toBe(false);
            const record = await birthdayManager.getOne({ userId: 'user-upsert-2' });
            expect(record?.channelId).toBe('channel-new');
        });
    });

    describe('findOrCreate', () => {
        it('should create a new record if not found', async () => {
            const [record, created] = await birthdayManager.findOrCreate({
                where: { userId: 'user-find-create' },
                defaults: {
                    userId: 'user-find-create',
                    day: 15,
                    month: 6,
                    guildId: 'guild-1',
                    channelId: 'channel-1',
                },
            });

            expect(created).toBe(true);
            expect(record.userId).toBe('user-find-create');
        });

        it('should return existing record if found', async () => {
            await BirthdayConfig.create({
                userId: 'user-existing',
                day: 10,
                month: 5,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const [record, created] = await birthdayManager.findOrCreate({
                where: { userId: 'user-existing' },
                defaults: {
                    userId: 'user-existing',
                    day: 15,
                    month: 6,
                    guildId: 'guild-2',
                    channelId: 'channel-2',
                },
            });

            expect(created).toBe(false);
            expect(record.guildId).toBe('guild-1');
        });
    });

    describe('exists', () => {
        it('should return true if record exists', async () => {
            await BirthdayConfig.create({
                userId: 'user-exists',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const exists = await birthdayManager.exists({ userId: 'user-exists' });
            expect(exists).toBe(true);
        });

        it('should return false if record does not exist', async () => {
            const exists = await birthdayManager.exists({ userId: 'non-existent' });
            expect(exists).toBe(false);
        });
    });

    describe('getAndCountAll', () => {
        it('should return records with count', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            await BirthdayConfig.create({
                userId: 'user-2',
                day: 2,
                month: 2,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const result = await birthdayManager.getAndCountAll();
            expect(result.count).toBe(2);
            expect(result.rows).toHaveLength(2);
        });
    });

    describe('findByPk', () => {
        it('should find record by primary key', async () => {
            await BirthdayConfig.create({
                userId: 'user-pk',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const record = await birthdayManager.findByPk('user-pk');
            expect(record).not.toBeNull();
            expect(record?.userId).toBe('user-pk');
        });
    });

    describe('findByPkPlain', () => {
        it('should find record by primary key as plain object', async () => {
            await BirthdayConfig.create({
                userId: 'user-pk-plain',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const record = await birthdayManager.findByPkPlain('user-pk-plain');
            expect(record).not.toBeNull();
            expect(record).toHaveProperty('userId', 'user-pk-plain');
        });
    });

    describe('update', () => {
        it('should update records matching criteria', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-old',
            });

            await birthdayManager.update(
                { channelId: 'channel-new' },
                { userId: 'user-1' }
            );

            const record = await birthdayManager.getOne({ userId: 'user-1' });
            expect(record?.channelId).toBe('channel-new');
        });
    });

    describe('remove', () => {
        it('should remove records matching criteria', async () => {
            await BirthdayConfig.create({
                userId: 'user-remove',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const deletedCount = await birthdayManager.remove({ userId: 'user-remove' });
            expect(deletedCount).toBe(1);

            const record = await birthdayManager.getOne({ userId: 'user-remove' });
            expect(record).toBeNull();
        });

        it('should remove multiple records', async () => {
            await BirthdayConfig.create({
                userId: 'user-1',
                day: 1,
                month: 1,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            await BirthdayConfig.create({
                userId: 'user-2',
                day: 2,
                month: 2,
                guildId: 'guild-1',
                channelId: 'channel-1',
            });

            const deletedCount = await birthdayManager.remove({ guildId: 'guild-1' });
            expect(deletedCount).toBe(2);
        });
    });
});
