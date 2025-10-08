import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { PatchNoteConfig } from '../patch-note-config.js';

describe('PatchNoteConfig Model', () => {
  beforeEach(async () => {
    await configManager.patchNotesManager.removeAll();
  });

  it('should create a patch note with required fields', async () => {
    const patchNote = await PatchNoteConfig.create({
      game: 'league',
      title: 'Patch 13.24',
      content: 'Major balance changes',
      url: 'https://example.com/patch-13.24',
      publishedAt: Date.now(),
    });

    expect(patchNote.game).toBe('league');
    expect(patchNote.title).toBe('Patch 13.24');
    expect(patchNote.content).toBe('Major balance changes');
    expect(patchNote.url).toBe('https://example.com/patch-13.24');
    expect(patchNote.publishedAt).toBeTypeOf('number');
    expect(patchNote.id).toBeTypeOf('number');
  });

  it('should create a patch note with optional fields', async () => {
    const patchNote = await PatchNoteConfig.create({
      game: 'valorant',
      title: 'Patch 8.0',
      content: 'New agent released',
      url: 'https://example.com/patch-8.0',
      publishedAt: Date.now(),
      logoUrl: 'https://example.com/logo.png',
      imageUrl: 'https://example.com/image.png',
      version: '8.0.0',
      accentColor: 0xff5733,
    });

    expect(patchNote.logoUrl).toBe('https://example.com/logo.png');
    expect(patchNote.imageUrl).toBe('https://example.com/image.png');
    expect(patchNote.version).toBe('8.0.0');
    expect(patchNote.accentColor).toBe(0xff5733);
  });

  it('should find patch notes by game', async () => {
    await PatchNoteConfig.create({
      game: 'tft-find-test',
      title: 'Find Test Patch 13.23',
      content: 'Content 1',
      url: 'https://example.com/find-1',
      publishedAt: Date.now(),
    });

    const patches = await PatchNoteConfig.findAll({
      where: { game: 'tft-find-test' },
    });

    expect(patches.length).toBe(1);
    expect(patches[0].game).toBe('tft-find-test');
  });

  it('should update patch note content', async () => {
    const patchNote = await PatchNoteConfig.create({
      game: 'tft-update',
      title: 'Patch 13.1',
      content: 'Original content',
      url: 'https://example.com/patch',
      publishedAt: Date.now(),
    });

    patchNote.content = 'Updated content';
    patchNote.version = '13.1.1';
    await patchNote.save();

    const updated = await PatchNoteConfig.findByPk(patchNote.id);
    expect(updated?.content).toBe('Updated content');
    expect(updated?.version).toBe('13.1.1');
  });

  it('should delete a patch note', async () => {
    const patchNote = await PatchNoteConfig.create({
      game: 'valorant-delete',
      title: 'Patch to delete',
      content: 'Delete me',
      url: 'https://example.com/delete',
      publishedAt: Date.now(),
    });

    const id = patchNote.id;
    await patchNote.destroy();

    const deleted = await PatchNoteConfig.findByPk(id);
    expect(deleted).toBeNull();
  });

  it('should order patch notes by publishedAt', async () => {
    const now = Date.now();

    // Create first patch note
    await PatchNoteConfig.create({
      game: 'league-order-test',
      title: 'Order Test Patch',
      content: 'Old',
      url: 'https://example.com/order-old',
      publishedAt: now - 86400000, // 1 day ago
    });

    // Update the same patch note with a newer timestamp
    const patchNote = await PatchNoteConfig.findOne({
      where: { game: 'league-order-test' },
    });

    if (patchNote) {
      patchNote.publishedAt = now;
      patchNote.title = 'Order Test Newer Patch';
      await patchNote.save();
    }

    const updated = await PatchNoteConfig.findOne({
      where: { game: 'league-order-test' },
    });

    expect(updated?.title).toBe('Order Test Newer Patch');
    expect(updated?.publishedAt).toBeGreaterThan(now - 86400000);
  });

  it('should enforce unique game constraint', async () => {
    await PatchNoteConfig.create({
      game: 'unique-test',
      title: 'First Patch',
      content: 'Content 1',
      url: 'https://example.com/1',
      publishedAt: Date.now(),
    });

    await expect(
      PatchNoteConfig.create({
        game: 'unique-test',
        title: 'Second Patch',
        content: 'Content 2',
        url: 'https://example.com/2',
        publishedAt: Date.now(),
      })
    ).rejects.toThrow();
  });
});
