import type { RolePermissionSnapshotData, RolePermissionSnapshotMemberNames } from '@zeffuro/fakegaming-common/models';
import { API_ENDPOINTS, apiRequest } from './core';

export interface RolePermissionSnapshotRecord {
    id: number;
    guildId: string;
    guildName: string;
    createdById: string;
    snapshot: RolePermissionSnapshotData;
    createdAt: string;
}

interface RolePermissionSnapshotsResponse {
    snapshots: RolePermissionSnapshotRecord[];
}

interface RolePermissionSnapshotResponse {
    snapshot: RolePermissionSnapshotRecord;
    memberNames?: RolePermissionSnapshotMemberNames;
}

interface LiveRolePermissionSnapshotResponse {
    snapshot: RolePermissionSnapshotData;
    memberNames: RolePermissionSnapshotMemberNames;
}

function guildQuery(guildId: string): string {
    return `?guildId=${encodeURIComponent(guildId)}`;
}

export const rolePermissionSnapshotsApi = {
    getRolePermissionSnapshots: (guildId: string) =>
        apiRequest<RolePermissionSnapshotsResponse>(`${API_ENDPOINTS.ROLE_PERMISSION_SNAPSHOTS}${guildQuery(guildId)}`),

    getRolePermissionSnapshot: (guildId: string, id: number) =>
        apiRequest<RolePermissionSnapshotResponse>(`${API_ENDPOINTS.ROLE_PERMISSION_SNAPSHOTS}/${id}${guildQuery(guildId)}`),

    getLiveRolePermissionSnapshot: (guildId: string) =>
        apiRequest<LiveRolePermissionSnapshotResponse>(`${API_ENDPOINTS.ROLE_PERMISSION_SNAPSHOTS}/live${guildQuery(guildId)}`),

    saveLiveRolePermissionSnapshot: (guildId: string) =>
        apiRequest<RolePermissionSnapshotResponse>(`${API_ENDPOINTS.ROLE_PERMISSION_SNAPSHOTS}/live${guildQuery(guildId)}`, { method: 'POST' }),

    deleteRolePermissionSnapshot: (guildId: string, id: number) =>
        apiRequest<void>(`${API_ENDPOINTS.ROLE_PERMISSION_SNAPSHOTS}/${id}${guildQuery(guildId)}`, { method: 'DELETE' }),
};
