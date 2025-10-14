import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useUserData } from '@/components/hooks/useUserData';
import { mountWithSnapshots, createHookProbe0 } from '../testing/reactTesting';
import { withFetchMock } from '@zeffuro/fakegaming-common/testing';

// Generic hook probe to capture state over renders
const HookProbe = createHookProbe0(useUserData);

const { mockOkJsonOnce, mockErrorJsonOnce } = withFetchMock();

describe('useUserData', () => {
    beforeEach(() => {
        // reset cookie between tests
        Object.defineProperty(document, 'cookie', { value: '', writable: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(document, 'cookie', { value: '', writable: true });
    });

    it('loads user successfully via /api/user', async () => {
        const payload = { id: '1', username: 'alice', global_name: 'Alice', avatar: 'av' };
        mockOkJsonOnce(payload);

        const { snapshots, last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { onSnapshot })
        );

        const final = last();
        expect(final?.loading).toBe(false);
        expect(final?.error).toBeNull();
        expect(final?.user).toEqual(payload);
        expect(final?.getUserDisplayName()).toBe('Alice');
        expect(final?.getUserAvatarUrl()).toBe('https://cdn.discordapp.com/avatars/1/av.png');

        unmount();
        // keep snapshots referenced to avoid unused var elimination in some editors
        void snapshots;
    });

    it('sets error when /api/user fails', async () => {
        mockErrorJsonOnce(400, { error: 'nope' });

        const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { onSnapshot })
        );

        const final = last();
        expect(final?.loading).toBe(false);
        expect(final?.user).toBeNull();
        expect(typeof final?.error).toBe('string');
        expect(final?.error).toBe('Failed to fetch user data');

        unmount();
    });
});
