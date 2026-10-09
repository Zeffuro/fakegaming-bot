import { beforeEach, describe, expect, it } from 'vitest';
import { UserCommandPreset } from '../../models/user-command-preset.js';
import { UserCommandPresetManager } from '../userCommandPresetManager.js';

describe('command preset persistence', () => {
    const manager = new UserCommandPresetManager();
    beforeEach(async () => { await UserCommandPreset.destroy({ where: {} }); });

    it('updates normalized names, survives recreation and isolates all reads/deletes', async () => {
        const first = await manager.save('owner', ' My Weather ', 'weather', { location: 'Amsterdam' });
        const second = await manager.save('owner', 'my weather', 'weather', { location: 'Rotterdam' });
        expect(second.id).toBe(first.id);
        const saved = await new UserCommandPresetManager().get('owner', 'MY WEATHER');
        expect(JSON.parse(saved!.argumentsJson)).toEqual({ location: 'Rotterdam' });
        expect(await manager.get('other', 'my weather')).toBeNull();
        expect(await manager.list('other')).toEqual([]);
        expect(await manager.remove('other', 'my weather')).toBe(false);
        expect(await manager.remove('owner', 'my weather')).toBe(true);
    });

    it('bounds private presets and replaces an existing entry at capacity', async () => {
        await Promise.all(Array.from({ length: 50 }, (_, index) => manager.save('owner', `preset ${index}`, 'weather', { location: 'Amsterdam' })));
        await expect(manager.save('owner', 'new', 'weather', {})).rejects.toThrow('preset-capacity');
        await expect(manager.save('owner', 'preset 1', 'time', { time: 'now' })).resolves.toMatchObject({ commandPath: 'time' });
        await expect(manager.save('owner', ' ', 'weather', {})).rejects.toThrow();
    });
});
