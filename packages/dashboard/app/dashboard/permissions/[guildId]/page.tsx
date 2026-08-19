"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    InputAdornment,
    LinearProgress,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import {
    Download,
    ExpandMore,
    Folder,
    Group,
    Refresh,
    Save,
    Search,
    Security,
    Tag,
    DeleteOutlined,
    UnfoldLess,
    UnfoldMore,
} from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useRolePermissionSnapshots } from "@/components/hooks/useRolePermissionSnapshots";
import { dashboardAccents, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import type {
    RolePermissionSnapshotChannel,
    RolePermissionSnapshotData,
    RolePermissionSnapshotMemberNames,
    RolePermissionSnapshotPermissionOverwrite,
    RolePermissionSnapshotRole,
} from "@zeffuro/fakegaming-common/models";

type SnapshotSelection = "live" | number;

export default function GuildPermissionsPage() {
    const { guild, guildId, guildsLoading } = useGuildFromParams();
    const guildReady = Boolean(guild && guildId);
    const permissions = useRolePermissionSnapshots(guildId as string, { enabled: guildReady });
    const [selection, setSelection] = useState<SnapshotSelection>("live");
    const [search, setSearch] = useState("");
    const [expandedAccordionIds, setExpandedAccordionIds] = useState<Set<string>>(() => new Set());

    useEffect(() => {
        if (guildReady) void permissions.refreshLive();
    }, [guildReady, permissions.refreshLive]);

    const selectedSnapshot = useMemo(() => {
        if (selection === "live") return permissions.liveSnapshot;
        return permissions.snapshots.find(snapshot => snapshot.id === selection)?.snapshot ?? null;
    }, [permissions.liveSnapshot, permissions.snapshots, selection]);
    const fallbackSnapshot = selection === "live" && !selectedSnapshot ? permissions.snapshots[0]?.snapshot ?? null : selectedSnapshot;
    const activeSnapshot = fallbackSnapshot;
    const normalizedSearch = search.trim().toLowerCase();
    const summary = useMemo(() => activeSnapshot ? summarizeSnapshot(activeSnapshot) : null, [activeSnapshot]);
    const accordionIds = useMemo(() => activeSnapshot ? snapshotAccordionIds(activeSnapshot) : [], [activeSnapshot]);
    const allAccordionsExpanded = accordionIds.length > 0 && accordionIds.every(id => expandedAccordionIds.has(id));

    useEffect(() => {
        setExpandedAccordionIds(new Set());
    }, [activeSnapshot?.capturedAt, selection]);

    if (!guild && !guildsLoading) return <GuildAccessError />;

    const refreshLive = async () => {
        setSelection("live");
        await permissions.refreshLive();
    };

    const saveLive = async () => {
        setSelection("live");
        await permissions.saveLiveSnapshot();
    };

    const deleteSelectedSnapshot = async () => {
        if (selection === "live") return;
        if (!window.confirm(`Delete permission snapshot #${selection}? This cannot be undone.`)) return;
        if (await permissions.deleteSnapshot(selection)) setSelection("live");
    };

    const setAccordionExpanded = (accordionId: string, expanded: boolean) => {
        setExpandedAccordionIds(current => {
            const next = new Set(current);
            if (expanded) next.add(accordionId);
            else next.delete(accordionId);
            return next;
        });
    };

    return (
        <DashboardLayout guild={guild} currentModule="permissions" maxWidth="xl" loading={guildsLoading}>
            {guild && (
                <FeatureShell accent={dashboardAccents.commands} secondaryAccent={dashboardAccents.settings}>
                    <FeatureHero
                        icon={<Security />}
                        eyebrow="Permissions"
                        title="Permission State"
                        description="Live role, member, category, and channel overwrite details with saved historical snapshots."
                        accent={dashboardAccents.commands}
                        secondaryAccent={dashboardAccents.settings}
                        stats={[
                            { label: "Roles", value: summary?.roles ?? "-" },
                            { label: "Channels", value: summary?.channels ?? "-" },
                            { label: "Categories", value: summary?.categories ?? "-" },
                            { label: "Overwrites", value: summary?.overwrites ?? "-" },
                        ]}
                        actions={(
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                    variant="contained"
                                    startIcon={<Refresh />}
                                    onClick={() => void refreshLive()}
                                    disabled={permissions.refreshingLive}
                                    sx={primaryActionButtonSx(dashboardAccents.commands)}
                                >
                                    Refresh Live
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<Save />}
                                    onClick={() => void saveLive()}
                                    disabled={permissions.saving}
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    Save Snapshot
                                </Button>
                            </Stack>
                        )}
                    />

                    {permissions.error ? (
                        <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }}>
                            {permissions.error}
                        </Alert>
                    ) : null}

                    <FeaturePanel accent={dashboardAccents.commands}>
                        <Stack spacing={2.5}>
                            {(permissions.loading || permissions.refreshingLive || permissions.saving) ? (
                                <LinearProgress sx={{ height: 4, borderRadius: 1, bgcolor: "rgba(255,255,255,0.08)", "& .MuiLinearProgress-bar": { bgcolor: dashboardAccents.commands } }} />
                            ) : null}

                            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
                                <TextField
                                    select
                                    label="Permission state"
                                    value={selection}
                                    onChange={event => setSelection(event.target.value === "live" ? "live" : Number(event.target.value))}
                                    size="small"
                                    sx={fieldSx}
                                >
                                    <MenuItem value="live">Live state</MenuItem>
                                    {permissions.snapshots.map(snapshot => (
                                        <MenuItem key={snapshot.id} value={snapshot.id}>
                                            Snapshot #{snapshot.id} - {formatTimestamp(snapshot.createdAt)}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    placeholder="Filter roles, channels, permissions, or members"
                                    size="small"
                                    fullWidth
                                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search sx={{ color: "rgba(255,255,255,0.48)" }} /></InputAdornment> } }}
                                    sx={{ ...fieldSx, flex: 1 }}
                                />
                            </Stack>

                            {activeSnapshot ? (
                                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<UnfoldMore />}
                                        onClick={() => setExpandedAccordionIds(new Set(accordionIds))}
                                        disabled={allAccordionsExpanded}
                                        sx={ghostActionButtonSx(dashboardAccents.settings)}
                                    >
                                        Expand all
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<UnfoldLess />}
                                        onClick={() => setExpandedAccordionIds(new Set())}
                                        disabled={expandedAccordionIds.size === 0}
                                        sx={ghostActionButtonSx(dashboardAccents.settings)}
                                    >
                                        Collapse all
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Download />}
                                        onClick={() => downloadSnapshot(activeSnapshot)}
                                        sx={ghostActionButtonSx(dashboardAccents.commands)}
                                    >
                                        Export JSON
                                    </Button>
                                    {selection !== "live" ? (
                                        <Button
                                            variant="outlined"
                                            startIcon={<DeleteOutlined />}
                                            onClick={() => void deleteSelectedSnapshot()}
                                            disabled={permissions.deletingSnapshotId === selection}
                                            sx={ghostActionButtonSx(dashboardAccents.quotes)}
                                        >
                                            Delete snapshot
                                        </Button>
                                    ) : null}
                                </Stack>
                            ) : null}

                            {!activeSnapshot && !permissions.loading && !permissions.refreshingLive ? (
                                <Alert severity="info" sx={{ bgcolor: "rgba(104,215,255,0.10)", color: "grey.100", border: "1px solid rgba(104,215,255,0.20)" }}>
                                    No permission data is available yet. Refresh the live state or save a snapshot from the bot.
                                </Alert>
                            ) : null}

                            {activeSnapshot ? (
                                <>
                                    <SourceSummary snapshot={activeSnapshot} />
                                    {selection !== "live" ? (
                                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.54)" }}>
                                            Member IDs are historical; displayed names are resolved from the current live server state and may have changed.
                                        </Typography>
                                    ) : null}
                                    <RolePermissions
                                        snapshot={activeSnapshot}
                                        memberNames={permissions.memberNames}
                                        search={normalizedSearch}
                                        expandedAccordionIds={expandedAccordionIds}
                                        onAccordionExpandedChange={setAccordionExpanded}
                                    />
                                    <ChannelPermissions
                                        snapshot={activeSnapshot}
                                        memberNames={permissions.memberNames}
                                        search={normalizedSearch}
                                        expandedAccordionIds={expandedAccordionIds}
                                        onAccordionExpandedChange={setAccordionExpanded}
                                    />
                                </>
                            ) : null}
                        </Stack>
                    </FeaturePanel>
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}

function SourceSummary({ snapshot }: { snapshot: RolePermissionSnapshotData }) {
    const rows = [
        { label: "Captured", value: formatTimestamp(snapshot.capturedAt) },
        { label: "Roles", value: `${snapshot.roleData?.capturedRoleCount ?? snapshot.roles.length} (${snapshot.roleData?.source ?? "unavailable"})` },
        { label: "Members", value: `${snapshot.memberData?.capturedMemberCount ?? 0} (${snapshot.memberData?.source ?? "unavailable"})` },
        { label: "Channels", value: `${snapshot.channelData?.capturedChannelCount ?? snapshot.channels?.length ?? 0} (${snapshot.channelData?.source ?? "unavailable"})` },
    ];

    return (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
            {rows.map(row => (
                <Box key={row.label} sx={{ px: 1.25, py: 1, borderRadius: 1, border: "1px solid rgba(255,255,255,0.10)", bgcolor: "rgba(255,255,255,0.035)" }}>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.50)", display: "block" }}>{row.label}</Typography>
                    <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750, overflowWrap: "anywhere" }}>{row.value}</Typography>
                </Box>
            ))}
        </Box>
    );
}

function RolePermissions({
    snapshot,
    memberNames,
    search,
    expandedAccordionIds,
    onAccordionExpandedChange,
}: {
    snapshot: RolePermissionSnapshotData;
    memberNames: RolePermissionSnapshotMemberNames;
    search: string;
    expandedAccordionIds: Set<string>;
    onAccordionExpandedChange: (accordionId: string, expanded: boolean) => void;
}) {
    const roles = snapshot.roles.filter(role => matchesRole(role, memberNames, search));

    return (
        <Box>
            <SectionHeader icon={<Group />} title="Roles and Members" count={roles.length} />
            <Stack spacing={1}>
                {roles.map(role => (
                    <RoleRow
                        key={role.id}
                        role={role}
                        memberNames={memberNames}
                        expanded={expandedAccordionIds.has(roleAccordionId(role.id))}
                        onExpandedChange={onAccordionExpandedChange}
                    />
                ))}
                {roles.length === 0 ? <EmptyState label="No roles match the current filter." /> : null}
            </Stack>
        </Box>
    );
}

function RoleRow({
    role,
    memberNames,
    expanded,
    onExpandedChange,
}: {
    role: RolePermissionSnapshotRole;
    memberNames: RolePermissionSnapshotMemberNames;
    expanded: boolean;
    onExpandedChange: (accordionId: string, expanded: boolean) => void;
}) {
    return (
        <Accordion disableGutters expanded={expanded} onChange={(_event, nextExpanded) => onExpandedChange(roleAccordionId(role.id), nextExpanded)} sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMore sx={{ color: "rgba(255,255,255,0.62)" }} />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0, flexWrap: "wrap", rowGap: 0.75 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: role.hexColor, border: "1px solid rgba(255,255,255,0.28)" }} />
                    <Typography variant="body2" sx={{ color: "grey.50", fontWeight: 800, overflowWrap: "anywhere" }}>{role.name}</Typography>
                    <Chip size="small" label={`${role.members.length} members`} sx={chipSx(dashboardAccents.commands)} />
                    <Chip size="small" label={`${role.permissions.length} permissions`} sx={chipSx(dashboardAccents.settings)} />
                </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
                <Stack spacing={1.25}>
                    <PermissionLine label="Server permissions" permissions={role.permissions} emptyLabel="No explicit permissions" />
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>Bitfield: {role.permissionsBitfield}</Typography>
                    <MemberList members={role.members} memberNames={memberNames} />
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}

function ChannelPermissions({
    snapshot,
    memberNames,
    search,
    expandedAccordionIds,
    onAccordionExpandedChange,
}: {
    snapshot: RolePermissionSnapshotData;
    memberNames: RolePermissionSnapshotMemberNames;
    search: string;
    expandedAccordionIds: Set<string>;
    onAccordionExpandedChange: (accordionId: string, expanded: boolean) => void;
}) {
    const allChannels = snapshot.channels ?? [];
    const roleNames = new Map(snapshot.roles.map(role => [role.id, role.name]));
    const categories = allChannels.filter(channel => channel.kind === "category");
    const categoryIds = new Set(categories.map(category => category.id));
    const categoryGroups = categories
        .map(category => {
            const children = allChannels.filter(channel => channel.parentId === category.id);
            const categoryMatches = matchesChannel(category, search);
            const matchingChildren = children.filter(channel => categoryMatches || matchesChannel(channel, search));
            return { category, channels: [category, ...matchingChildren] };
        })
        .filter(group => !search || group.channels.length > 1 || matchesChannel(group.category, search));
    const rootChannels = allChannels.filter(channel => channel.kind !== "category" && (!channel.parentId || !categoryIds.has(channel.parentId)) && matchesChannel(channel, search));
    const visibleCount = categoryGroups.reduce((count, group) => count + group.channels.length, 0) + rootChannels.length;

    return (
        <Box>
            <SectionHeader icon={<Folder />} title="Categories and Channels" count={visibleCount} />
            <Stack spacing={1.25}>
                {categoryGroups.map(group => (
                    <ChannelGroup
                        key={group.category.id}
                        title={group.category.name}
                        icon={<Folder fontSize="small" />}
                        channels={group.channels}
                        roleNames={roleNames}
                        memberNames={memberNames}
                        expandedAccordionIds={expandedAccordionIds}
                        onAccordionExpandedChange={onAccordionExpandedChange}
                    />
                ))}
                {rootChannels.length > 0 ? (
                    <ChannelGroup
                        title="No category"
                        icon={<Tag fontSize="small" />}
                        channels={rootChannels}
                        roleNames={roleNames}
                        memberNames={memberNames}
                        expandedAccordionIds={expandedAccordionIds}
                        onAccordionExpandedChange={onAccordionExpandedChange}
                    />
                ) : null}
                {visibleCount === 0 ? <EmptyState label="No channels or categories match the current filter." /> : null}
            </Stack>
        </Box>
    );
}

function ChannelGroup({
    title,
    icon,
    channels,
    roleNames,
    memberNames,
    expandedAccordionIds,
    onAccordionExpandedChange,
}: {
    title: string;
    icon: React.ReactNode;
    channels: RolePermissionSnapshotChannel[];
    roleNames: Map<string, string>;
    memberNames: RolePermissionSnapshotMemberNames;
    expandedAccordionIds: Set<string>;
    onAccordionExpandedChange: (accordionId: string, expanded: boolean) => void;
}) {
    return (
        <Box sx={{ borderLeft: `3px solid ${dashboardAccents.settings}`, pl: 1.25 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.75, color: dashboardAccents.settings }}>
                {icon}
                <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 800 }}>{title}</Typography>
            </Stack>
            <Stack spacing={0.75}>
                {channels.map(channel => (
                    <ChannelRow
                        key={channel.id}
                        channel={channel}
                        roleNames={roleNames}
                        memberNames={memberNames}
                        expanded={expandedAccordionIds.has(channelAccordionId(channel.id))}
                        onExpandedChange={onAccordionExpandedChange}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function ChannelRow({
    channel,
    roleNames,
    memberNames,
    expanded,
    onExpandedChange,
}: {
    channel: RolePermissionSnapshotChannel;
    roleNames: Map<string, string>;
    memberNames: RolePermissionSnapshotMemberNames;
    expanded: boolean;
    onExpandedChange: (accordionId: string, expanded: boolean) => void;
}) {
    const explicitOverwrites = channel.permissionOverwrites.filter(hasExplicitOverwrite);
    const neutralOverwriteCount = channel.permissionOverwrites.length - explicitOverwrites.length;

    return (
        <Accordion disableGutters expanded={expanded} onChange={(_event, nextExpanded) => onExpandedChange(channelAccordionId(channel.id), nextExpanded)} sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMore sx={{ color: "rgba(255,255,255,0.62)" }} />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0, flexWrap: "wrap", rowGap: 0.75 }}>
                    <Typography variant="body2" sx={{ color: "grey.50", fontWeight: 800, overflowWrap: "anywhere" }}>{channel.name}</Typography>
                    <Chip size="small" label={channel.kind} sx={chipSx(dashboardAccents.settings)} />
                    <Chip size="small" label={`${explicitOverwrites.length} explicit`} sx={chipSx(dashboardAccents.commands)} />
                </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
                {explicitOverwrites.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>
                        No explicit allow or deny changes for this channel.
                        {neutralOverwriteCount > 0 && ` ${neutralOverwriteCount} neutral Discord ${neutralOverwriteCount === 1 ? "record does" : "records do"} not change access.`}
                    </Typography>
                ) : (
                    <Stack spacing={1}>
                        {explicitOverwrites.map(overwrite => (
                            <OverwriteRow key={`${overwrite.type}:${overwrite.id}`} overwrite={overwrite} roleNames={roleNames} memberNames={memberNames} />
                        ))}
                        {neutralOverwriteCount > 0 && (
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.50)" }}>
                                {neutralOverwriteCount} neutral Discord {neutralOverwriteCount === 1 ? "record does" : "records do"} not change access.
                            </Typography>
                        )}
                    </Stack>
                )}
            </AccordionDetails>
        </Accordion>
    );
}

function OverwriteRow({
    overwrite,
    roleNames,
    memberNames,
}: {
    overwrite: RolePermissionSnapshotPermissionOverwrite;
    roleNames: Map<string, string>;
    memberNames: RolePermissionSnapshotMemberNames;
}) {
    const subject = overwrite.type === "role"
        ? `Role: ${roleNames.get(overwrite.id) ?? overwrite.id}`
        : overwrite.type === "member"
            ? `Member: ${memberNames[overwrite.id] ?? overwrite.id}`
            : `Unknown: ${overwrite.id}`;

    return (
        <Box sx={{ px: 1.25, py: 1, borderRadius: 1, border: "1px solid rgba(255,255,255,0.09)", bgcolor: "rgba(255,255,255,0.03)" }}>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750, mb: 0.75, overflowWrap: "anywhere" }}>Direct override: {subject}</Typography>
            <PermissionLine label="Explicitly allowed" permissions={overwrite.allowPermissions} emptyLabel="None" accent={dashboardAccents.settings} />
            <PermissionLine label="Explicitly denied" permissions={overwrite.denyPermissions} emptyLabel="None" accent={dashboardAccents.quotes} />
        </Box>
    );
}

function MemberList({
    members,
    memberNames,
}: {
    members: RolePermissionSnapshotRole["members"];
    memberNames: RolePermissionSnapshotMemberNames;
}) {
    if (members.length === 0) {
        return <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>No members were available in this snapshot.</Typography>;
    }

    return (
        <Box>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.50)", display: "block", mb: 0.5 }}>Members</Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                {members.map(member => (
                    <Chip
                        key={member.id}
                        size="small"
                        label={memberNames[member.id] ? `${memberNames[member.id]} (${member.id})` : member.id}
                        sx={chipSx(dashboardAccents.neutral)}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function PermissionLine({
    label,
    permissions,
    emptyLabel,
    accent = dashboardAccents.commands,
}: {
    label: string;
    permissions: string[];
    emptyLabel: string;
    accent?: string;
}) {
    return (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} sx={{ alignItems: { sm: "flex-start" }, mb: 0.75 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.50)", minWidth: 112 }}>{label}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                {permissions.length > 0
                    ? permissions.map(permission => <Chip key={permission} size="small" label={permission} sx={chipSx(accent)} />)
                    : <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.54)" }}>{emptyLabel}</Typography>}
            </Stack>
        </Stack>
    );
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
    return (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.25 }}>
            <Box sx={{ color: dashboardAccents.commands, display: "grid", placeItems: "center" }}>{icon}</Box>
            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>{title}</Typography>
            <Chip size="small" label={count} sx={chipSx(dashboardAccents.settings)} />
        </Stack>
    );
}

function EmptyState({ label }: { label: string }) {
    return <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)", py: 1 }}>{label}</Typography>;
}

function summarizeSnapshot(snapshot: RolePermissionSnapshotData) {
    const channels = snapshot.channels ?? [];
    return {
        roles: snapshot.roles.length,
        channels: channels.length,
        categories: channels.filter(channel => channel.kind === "category").length,
        overwrites: channels.reduce((total, channel) => total + channel.permissionOverwrites.filter(hasExplicitOverwrite).length, 0),
    };
}

function snapshotAccordionIds(snapshot: RolePermissionSnapshotData): string[] {
    return [
        ...snapshot.roles.map(role => roleAccordionId(role.id)),
        ...(snapshot.channels ?? []).map(channel => channelAccordionId(channel.id)),
    ];
}

function roleAccordionId(roleId: string): string {
    return `role:${roleId}`;
}

function channelAccordionId(channelId: string): string {
    return `channel:${channelId}`;
}

function hasExplicitOverwrite(overwrite: RolePermissionSnapshotPermissionOverwrite): boolean {
    return overwrite.allow !== "0" || overwrite.deny !== "0";
}

function matchesRole(role: RolePermissionSnapshotRole, memberNames: RolePermissionSnapshotMemberNames, search: string): boolean {
    if (!search) return true;
    return [
        role.id,
        role.name,
        ...role.permissions,
        ...role.members.flatMap(member => [member.id, memberNames[member.id] ?? ""]),
    ].some(value => value.toLowerCase().includes(search));
}

function matchesChannel(channel: RolePermissionSnapshotChannel, search: string): boolean {
    if (!search) return true;
    return [
        channel.id,
        channel.name,
        channel.kind,
        ...channel.permissionOverwrites.flatMap(overwrite => [
            overwrite.id,
            overwrite.type,
            ...overwrite.allowPermissions,
            ...overwrite.denyPermissions,
        ]),
    ].some(value => value.toLowerCase().includes(search));
}

function downloadSnapshot(snapshot: RolePermissionSnapshotData): void {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `role-permissions-${snapshot.guild.id}-${snapshot.capturedAt.replace(/[:.]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}

function formatTimestamp(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

const fieldSx = {
    minWidth: { xs: "100%", md: 260 },
    "& .MuiOutlinedInput-root": {
        color: "grey.100",
        bgcolor: "rgba(255,255,255,0.045)",
        borderRadius: 1,
        "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
        "&:hover fieldset": { borderColor: "rgba(255,255,255,0.24)" },
        "&.Mui-focused fieldset": { borderColor: dashboardAccents.commands },
    },
    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.58)" },
    "& input::placeholder": { color: "rgba(255,255,255,0.48)", opacity: 1 },
};

const accordionSx = {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "4px !important",
    bgcolor: "rgba(255,255,255,0.03)",
    color: "grey.100",
    "&:before": { display: "none" },
    "&.Mui-expanded": { my: 0 },
};

function chipSx(accent: string) {
    return {
        height: 22,
        color: "rgba(255,255,255,0.78)",
        bgcolor: `${accent}1F`,
        border: `1px solid ${accent}42`,
        "& .MuiChip-label": { overflowWrap: "anywhere" },
    };
}
