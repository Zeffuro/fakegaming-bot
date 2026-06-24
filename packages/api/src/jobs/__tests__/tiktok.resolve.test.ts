import { describe, it, expect, vi } from 'vitest';
import {
  buildTikTokDebugMeta,
  buildTikTokHealthMetadata,
  getTikTokSessionDiagnostics,
  resolveTikTokLive,
} from '../tiktok.js';

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

  it('builds sanitized session diagnostics without exposing cookie values', () => {
    const diagnostics = getTikTokSessionDiagnostics('sessionid=secret-value; ttwid=another-secret; theme=dark');

    expect(diagnostics).toMatchObject({
      cookieConfigured: true,
      cookiePairCount: 3,
      likelySessionCookiePresent: true,
      freshness: 'unknown',
      connectorUsesCookie: false,
    });
    expect(JSON.stringify(diagnostics)).not.toContain('secret-value');
    expect(JSON.stringify(diagnostics)).not.toContain('another-secret');
  });

  it('classifies fetch diagnostics without exposing raw connector errors', () => {
    const diagnostics = buildTikTokDebugMeta({
      live: false,
      debugMeta: { method: 'unknown', raw: 'Request failed with 403 and expired session cookie SECRET' },
    }, {
      now: new Date('2026-06-23T10:00:00.000Z'),
      cookieHeader: 'sessionid=SECRET',
    });

    expect(diagnostics).toMatchObject({
      method: 'unknown',
      fetchStatus: 'connect-failed',
      errorCode: 'TIKTOK_AUTH_REQUIRED',
      cachedOffline: false,
      checkedAt: '2026-06-23T10:00:00.000Z',
    });
    expect(JSON.stringify(diagnostics)).not.toContain('SECRET');
    expect(JSON.stringify(diagnostics)).not.toContain('expired session cookie');
  });

  it('formats poll health metadata from safe diagnostics', () => {
    const metadata = buildTikTokHealthMetadata('creator', {
      live: true,
      roomId: 'room-1',
      debugMeta: { method: 'connect' },
    }, {
      eventId: 'room-1',
      now: new Date('2026-06-23T10:00:00.000Z'),
      cookieHeader: '',
    });

    expect(metadata).toMatchObject({
      username: 'creator',
      isLive: true,
      eventId: 'room-1',
      lastFetchStatus: 'live',
      lastFetchErrorCode: null,
      lastFetchMethod: 'connect',
      cachedOffline: false,
      offlineBackoffUntil: null,
      tiktokSession: expect.objectContaining({
        cookieConfigured: false,
        connectorUsesCookie: false,
      }),
    });
  });
});
