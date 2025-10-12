import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useUserData } from '@/components/hooks/useUserData';
import jwt from 'jsonwebtoken';
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

    it('falls back to JWT cookie when /api/user is not ok', async () => {
        mockErrorJsonOnce(400, { error: 'nope' });
        const jwtSpy = vi.spyOn(jwt, 'decode').mockReturnValue({
            discordId: '42',
            username: 'bob',
            global_name: 'Bobby',
            avatar: 'img'
        } as any);
        Object.defineProperty(document, 'cookie', { value: 'foo=bar; jwt=token; x=y', writable: true });

        const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { onSnapshot })
        );

        const final = last();
        expect(final?.loading).toBe(false);
        expect(final?.error).toBeNull();
        expect(final?.user).toEqual({ id: '42', username: 'bob', global_name: 'Bobby', discriminator: undefined, avatar: 'img' });
        expect(final?.getUserDisplayName()).toBe('Bobby');
        expect(final?.getUserAvatarUrl()).toBe('https://cdn.discordapp.com/avatars/42/img.png');

        unmount();
        jwtSpy.mockRestore();
    });

    it('sets error when both /api/user fails and no valid JWT', async () => {
        mockErrorJsonOnce(400, { error: 'bad' });
        const jwtSpy = vi.spyOn(jwt, 'decode').mockReturnValue(null as any);
        Object.defineProperty(document, 'cookie', { value: 'foo=bar', writable: true });

        const { last, unmount } = await mountWithSnapshots((onSnapshot: (snap: any) => void) =>
            React.createElement(HookProbe as any, { onSnapshot })
        );

        const final = last();
        expect(final?.loading).toBe(false);
        expect(final?.user).toBeNull();
        expect(typeof final?.error).toBe('string');
        expect(final?.error).toBe('Failed to fetch user data');

        unmount();
        jwtSpy.mockRestore();
    });
});
