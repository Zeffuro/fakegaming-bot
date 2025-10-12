import React, { useEffect, useRef } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Mount a React element that accepts an `onSnapshot` callback and capture all emitted snapshots.
 * The provided factory receives the `onSnapshot` function to pass into your probe component.
 */
export async function mountWithSnapshots<TSnapshot>(
    factory: (onSnapshot: (snap: TSnapshot) => void) => React.ReactElement
): Promise<{
    root: Root;
    container: HTMLDivElement;
    snapshots: TSnapshot[];
    last: () => TSnapshot | undefined;
    unmount: () => void;
    flush: () => Promise<void>;
}> {
    const container = document.createElement('div');
    const root = createRoot(container);
    const snapshots: TSnapshot[] = [];

    const onSnapshot = (snap: TSnapshot) => {
        snapshots.push(snap);
    };

    await act(async () => {
        root.render(factory(onSnapshot));
        // allow microtasks to flush
        await Promise.resolve();
    });

    const unmount = () => root.unmount();
    const last = () => snapshots[snapshots.length - 1];
    const flush = async () => {
        await act(async () => {
            await Promise.resolve();
        });
    };

    return { root, container, snapshots, last, unmount, flush };
}

/** Create a probe component for a hook with no arguments. */
export function createHookProbe0<T>(useHook: () => T) {
    return function HookProbe({ onSnapshot }: { onSnapshot: (snap: T) => void }) {
        const _ref = useRef<T | null>(null);
        const state = useHook();
        useEffect(() => {
            _ref.current = state;
            onSnapshot(state);
        }, [state, onSnapshot]);
        return React.createElement('div');
    };
}

/** Create a probe component for a hook with one argument. */
export function createHookProbe1<A, T>(useHook: (arg: A) => T) {
    return function HookProbe({ arg, onSnapshot }: { arg: A; onSnapshot: (snap: T) => void }) {
        const _ref = useRef<T | null>(null);
        const state = useHook(arg);
        useEffect(() => {
            _ref.current = state;
            onSnapshot(state);
        }, [state, onSnapshot]);
        return React.createElement('div');
    };
}
