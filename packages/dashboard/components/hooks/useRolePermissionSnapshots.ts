import { useCallback, useEffect, useState } from 'react';
import { api, type RolePermissionSnapshotRecord } from '@/lib/api-client';
import type { RolePermissionSnapshotData } from '@zeffuro/fakegaming-common/models';

interface UseRolePermissionSnapshotsOptions {
    enabled?: boolean;
}

export function useRolePermissionSnapshots(guildId: string, options: UseRolePermissionSnapshotsOptions = {}) {
    const enabled = options.enabled ?? true;
    const [snapshots, setSnapshots] = useState<RolePermissionSnapshotRecord[]>([]);
    const [liveSnapshot, setLiveSnapshot] = useState<RolePermissionSnapshotData | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [refreshingLive, setRefreshingLive] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadSnapshots = useCallback(async () => {
        if (!enabled || !guildId) {
            setSnapshots([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await api.getRolePermissionSnapshots(guildId);
            setSnapshots(response.snapshots);
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load permission snapshots');
            setSnapshots([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, guildId]);

    const refreshLive = useCallback(async () => {
        if (!enabled || !guildId) return;

        try {
            setRefreshingLive(true);
            const response = await api.getLiveRolePermissionSnapshot(guildId);
            setLiveSnapshot(response.snapshot);
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load live permission state');
        } finally {
            setRefreshingLive(false);
        }
    }, [enabled, guildId]);

    const saveLiveSnapshot = useCallback(async () => {
        if (!enabled || !guildId) return null;

        try {
            setSaving(true);
            const response = await api.saveLiveRolePermissionSnapshot(guildId);
            setSnapshots(current => [response.snapshot, ...current.filter(snapshot => snapshot.id !== response.snapshot.id)]);
            setLiveSnapshot(response.snapshot.snapshot);
            setError(null);
            return response.snapshot;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save the live permission snapshot');
            return null;
        } finally {
            setSaving(false);
        }
    }, [enabled, guildId]);

    useEffect(() => {
        void loadSnapshots();
    }, [loadSnapshots]);

    return {
        snapshots,
        liveSnapshot,
        loading,
        refreshingLive,
        saving,
        error,
        loadSnapshots,
        refreshLive,
        saveLiveSnapshot,
    };
}
