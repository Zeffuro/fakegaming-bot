import { describe, it, expect, vi } from 'vitest';
import React, { useEffect, useRef } from 'react';
import { useSupportedGames } from '@/components/hooks/useSupportedGames';
import { api } from '@/lib/api-client';
import { mountWithSnapshots } from '../testing/reactTesting';

// Minimal test component to exercise the hook without additional libs
function HookProbe({ onSnapshot }: { onSnapshot: (snap: any) => void }) {
  const snap = useRef<any>({});
  const state = useSupportedGames();
  // Capture snapshot on every render
  useEffect(() => {
    snap.current = state;
    onSnapshot(state);
  }, [state, onSnapshot]);
  return React.createElement('div');
}

describe('useSupportedGames', () => {
  it('loads games successfully', async () => {
    const spy = vi.spyOn(api, 'getSupportedGames').mockResolvedValueOnce(['Game A', 'Game B']);

    const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
      React.createElement(HookProbe, { onSnapshot })
    );

    // After initial render, loading should eventually be false with games populated
    const final = last();
    expect(Array.isArray(final?.games)).toBe(true);
    expect(final?.games).toEqual(['Game A', 'Game B']);
    expect(final?.loading).toBe(false);
    expect(final?.error).toBeNull();

    unmount();
    spy.mockRestore();
  });

  it('sets error when api fails', async () => {
    const spy = vi.spyOn(api, 'getSupportedGames').mockRejectedValueOnce(new Error('boom'));

    const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
      React.createElement(HookProbe, { onSnapshot })
    );

    const final = last();
    expect(final?.games).toEqual([]);
    expect(final?.loading).toBe(false);
    expect(final?.error).toBe('boom');

    unmount();
    spy.mockRestore();
  });
});
