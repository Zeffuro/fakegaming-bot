import { useCallback, useEffect, useState } from 'react';
import { api, type RolePermissionSnapshotRecord } from '@/lib/api-client';
import type { RolePermissionSnapshotData, RolePermissionSnapshotMemberNames } from '@zeffuro/fakegaming-common/models';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';

interface UseRolePermissionSnapshotsOptions {
    enabled?: boolean;
}

export function useRolePermissionSnapshots(guildId: string, options: UseRolePermissionSnapshotsOptions = {}) {
    const { t } = useDashboardI18n();
    const enabled = options.enabled ?? true;
    const [snapshots, setSnapshots] = useState<RolePermissionSnapshotRecord[]>([]);
    const [liveSnapshot, setLiveSnapshot] = useState<RolePermissionSnapshotData | null>(null);
    const [memberNames, setMemberNames] = useState<RolePermissionSnapshotMemberNames>({});
    const [loading, setLoading] = useState(enabled);
    const [refreshingLive, setRefreshingLive] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingSnapshotId, setDeletingSnapshotId] = useState<number | null>(null);
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
            setError(err instanceof Error ? err.message : t('hooks.failedToLoadPermissionSnapshots'));
            setSnapshots([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, guildId, t]);

    const refreshLive = useCallback(async () => {
        if (!enabled || !guildId) return;

        try {
            setRefreshingLive(true);
            const response = await api.getLiveRolePermissionSnapshot(guildId);
            setLiveSnapshot(response.snapshot);
            setMemberNames(response.memberNames ?? {});
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('hooks.failedToLoadLivePermissionState'));
        } finally {
            setRefreshingLive(false);
        }
    }, [enabled, guildId, t]);

    const saveLiveSnapshot = useCallback(async () => {
        if (!enabled || !guildId) return null;

        try {
            setSaving(true);
            const response = await api.saveLiveRolePermissionSnapshot(guildId);
            setSnapshots(current => [response.snapshot, ...current.filter(snapshot => snapshot.id !== response.snapshot.id)]);
            setLiveSnapshot(response.snapshot.snapshot);
            setMemberNames(response.memberNames ?? {});
            setError(null);
            return response.snapshot;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('hooks.failedToSaveLivePermissionSnapshot'));
            return null;
        } finally {
            setSaving(false);
        }
    }, [enabled, guildId, t]);

    const deleteSnapshot = useCallback(async (id: number) => {
        if (!enabled || !guildId) return false;
        try {
            setDeletingSnapshotId(id);
            await api.deleteRolePermissionSnapshot(guildId, id);
            setSnapshots(current => current.filter(snapshot => snapshot.id !== id));
            setError(null);
            return true;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('hooks.failedToDeletePermissionSnapshot'));
            return false;
        } finally {
            setDeletingSnapshotId(null);
        }
    }, [enabled, guildId, t]);

    useEffect(() => {
        void loadSnapshots();
    }, [loadSnapshots]);

    return {
        snapshots,
        liveSnapshot,
        memberNames,
        loading,
        refreshingLive,
        saving,
        deletingSnapshotId,
        error,
        loadSnapshots,
        refreshLive,
        saveLiveSnapshot,
        deleteSnapshot,
    };
}
