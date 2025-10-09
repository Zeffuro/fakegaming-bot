import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { QuoteConfig } from '../quote-config.js';

describe('QuoteConfig Model', () => {
  beforeEach(async () => {
    // Clean up before each test
    await configManager.quoteManager.removeAll();
  });

  it('should create a quote with all fields', async () => {
    const quote = await QuoteConfig.create({
      id: 'quote-123',
      guildId: 'guild-456',
      quote: 'This is a test quote',
      authorId: 'author-789',
      submitterId: 'submitter-101',
      timestamp: Date.now(),
    });

    expect(quote.id).toBe('quote-123');
    expect(quote.guildId).toBe('guild-456');
    expect(quote.quote).toBe('This is a test quote');
    expect(quote.authorId).toBe('author-789');
    expect(quote.submitterId).toBe('submitter-101');
    expect(quote.timestamp).toBeTypeOf('number');
  });

  it('should find quotes by guildId', async () => {
    await QuoteConfig.create({
      id: 'quote-1',
      guildId: 'test-guild',
      quote: 'Quote 1',
      authorId: 'author-1',
      submitterId: 'submitter-1',
      timestamp: Date.now(),
    });

    await QuoteConfig.create({
      id: 'quote-2',
      guildId: 'test-guild',
      quote: 'Quote 2',
      authorId: 'author-2',
      submitterId: 'submitter-2',
      timestamp: Date.now(),
    });

    const quotes = await QuoteConfig.findAll({
      where: { guildId: 'test-guild' },
    });

    expect(quotes).toHaveLength(2);
    expect(quotes[0].guildId).toBe('test-guild');
    expect(quotes[1].guildId).toBe('test-guild');
  });

  it('should update a quote', async () => {
    const quote = await QuoteConfig.create({
      id: 'quote-update',
      guildId: 'guild-update',
      quote: 'Original quote',
      authorId: 'author-original',
      submitterId: 'submitter-original',
      timestamp: Date.now(),
    });

    quote.quote = 'Updated quote';
    await quote.save();

    const updated = await QuoteConfig.findByPk('quote-update');
    expect(updated?.quote).toBe('Updated quote');
  });

  it('should delete a quote', async () => {
    const quote = await QuoteConfig.create({
      id: 'quote-delete',
      guildId: 'guild-delete',
      quote: 'Quote to delete',
      authorId: 'author-delete',
      submitterId: 'submitter-delete',
      timestamp: Date.now(),
    });

    await quote.destroy();

    const deleted = await QuoteConfig.findByPk('quote-delete');
    expect(deleted).toBeNull();
  });

  it('should find quotes by authorId', async () => {
    await QuoteConfig.create({
      id: 'quote-author-1',
      guildId: 'guild-author',
      quote: 'Author quote 1',
      authorId: 'specific-author',
      submitterId: 'submitter-x',
      timestamp: Date.now(),
    });

    await QuoteConfig.create({
      id: 'quote-author-2',
      guildId: 'guild-author',
      quote: 'Author quote 2',
      authorId: 'specific-author',
      submitterId: 'submitter-y',
      timestamp: Date.now(),
    });

    const authorQuotes = await QuoteConfig.findAll({
      where: { authorId: 'specific-author' },
    });

    expect(authorQuotes).toHaveLength(2);
    expect(authorQuotes.every(q => q.authorId === 'specific-author')).toBe(true);
  });
});
