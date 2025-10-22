import { describe, it, expect, vi } from 'vitest';
import { resolveTikTokLive } from '../tiktok.js';

// The TikTokLiveConnection is used internally; we won't import it directly, but we can mock its constructor via module mocking

vi.mock('tiktok-live-connector', () => {
  class FakeConn {
    public connected = false;
    public state: any = { roomInfo: { room: { id: '123', title: 'Live', create_time: Math.floor((Date.now()-60000)/1000), user_count: 42, background_image: 'img' } } };
    async connect() { this.connected = true; return this.state; }
    async disconnect() { this.connected = false; }
  }
  return { TikTokLiveConnection: FakeConn };
});

describe('resolveTikTokLive', () => {
  it('returns live true in light mode when connect succeeds', async () => {
    const info = await resolveTikTokLive('user1', undefined as any, { mode: 'light' });
    expect(info.live).toBe(true);
  });

  it('parses room info in default mode', async () => {
    const info = await resolveTikTokLive('user1');
    expect(info.live).toBe(true);
    expect(info.roomId).toBe('123');
    expect(typeof info.viewers).toBe('number');
  });

  it('returns live false when connect throws', async () => {
    // Override mock to throw on connect
    const { TikTokLiveConnection } = await import('tiktok-live-connector');
    (TikTokLiveConnection as any).prototype.connect = async function() { throw new Error('boom'); };
    const info = await resolveTikTokLive('user2');
    expect(info.live).toBe(false);
  });

  it('parses alternate shapes (string numbers and avatar cover)', async () => {
    const { TikTokLiveConnection } = await import('tiktok-live-connector');
    const ts = Math.floor((Date.now() - 120000) / 1000);
    (TikTokLiveConnection as any).prototype.connect = async function() {
      return { data: { room: { roomId: 'ABC', title: 'Cool', create_time: String(ts), user_count: '99', owner: { avatar_thumb: { url_list: ['https://img'] } } } } };
    };
    const info = await resolveTikTokLive('user3');
    expect(info.live).toBe(true);
    expect(info.roomId).toBe('ABC');
    expect(info.title).toBe('Cool');
    expect(typeof info.startedAt).toBe('number');
    expect(info.viewers).toBe(99);
    expect(info.cover).toBe('https://img');
  });

  it('handles unparsable room shapes gracefully', async () => {
    const { TikTokLiveConnection } = await import('tiktok-live-connector');
    (TikTokLiveConnection as any).prototype.connect = async function() { return {}; };
    const info = await resolveTikTokLive('user4');
    expect(info.live).toBe(true);
    expect(info.roomId ?? null).toBeNull();
    expect(info.title ?? null).toBeNull();
    expect(info.startedAt ?? null).toBeNull();
    expect(info.viewers ?? null).toBeNull();
    expect(info.cover ?? null).toBeNull();
  });
});
