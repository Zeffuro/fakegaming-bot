import React from "react";
import {
    Box,
    Typography,
    Alert,
    Paper,
    Button,
    SxProps,
    Theme
} from "@mui/material";
import { Add } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import AddConfigDialog from "@/components/AddConfigDialog";
import EditConfigDialog from "@/components/EditConfigDialog";
import NotificationConfigList from "@/components/NotificationConfigList";
import { useStreamingForm, type StreamingConfig } from "@/components/hooks/useStreamingForm";
import { useGuildChannels } from "@/components/hooks/useGuildChannels";
import Link from "next/link";
import { Stack, ButtonGroup } from "@mui/material";
import { LiveTv, YouTube as YouTubeIcon, SpeakerNotes } from "@mui/icons-material";

interface NotificationConfigPageProps<T extends StreamingConfig> {
    guildId: string;
    guild: any;
    configs: T[];
    loading: boolean;
    saving: boolean;
    error: string | null;
    moduleTitle: string;
    moduleIcon: React.ReactNode;
    moduleColor: string;
    moduleName: string;
    channelNameField: string;
    channelNameLabel: string;
    channelNamePlaceholder: string;

    onSetError: (error: string | null) => void;
    onAdd: (config: Omit<T, 'id' | 'guildId'>) => Promise<boolean>;
    onUpdate: (config: T) => Promise<boolean>;
    onDelete: (config: T) => Promise<boolean>;

    renderChip?: (config: T) => {
        label: string;
        color?: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
        variant?: "filled" | "outlined";
    } | undefined;

    itemSingularLabel?: string;
    itemPluralLabel?: string;
    showCustomMessage?: boolean;
    itemNameOptions?: string[];
    allowEdit?: boolean;
}

export default function NotificationConfigPage<T extends StreamingConfig>({
    guildId,
    guild,
    configs,
    loading,
    saving,
    error,
    moduleTitle,
    moduleIcon,
    moduleColor,
    moduleName,
    channelNameField,
    channelNameLabel,
    channelNamePlaceholder,
    onSetError,
    onAdd,
    onUpdate,
    onDelete,
    renderChip,
    itemSingularLabel,
    itemPluralLabel,
    showCustomMessage = true,
    itemNameOptions,
    allowEdit = true,
}: NotificationConfigPageProps<T>) {
    const { channels, loading: loadingChannels, getChannelName } = useGuildChannels(guildId);

    const singular = itemSingularLabel ?? (moduleName === 'YouTube' ? 'Channel' : 'Streamer');
    const plural = itemPluralLabel ?? (moduleName === 'YouTube' ? 'Channels' : 'Streamers');

    const {
        addDialogOpen,
        setAddDialogOpen,
        editingConfig,
        setEditingConfig,
        handleUpdateConfig,
        handleDeleteConfig,
    } = useStreamingForm<T>({
        onAdd,
        onUpdate,
        onDelete,
        channelNameField,
        guildId: guildId as string
    });

    const handleEditConfigChange = (field: string, value: any) => {
        if (!editingConfig) return;
        setEditingConfig({
            ...(editingConfig as any),
            [field]: value
        });
    };

    // Multi-level breadcrumbs for a clearer path
    const currentTrail = guild ? [
        { label: 'Settings', href: `/dashboard/settings/${encodeURIComponent(guild.id)}` },
        { label: 'Notifications', href: `/dashboard/settings/${encodeURIComponent(guild.id)}/notifications` },
        { label: moduleName, href: null }
    ] : null;

    return (
        <DashboardLayout guild={guild} currentModule={moduleName.toLowerCase()} currentTrail={currentTrail as any} maxWidth="lg" loading={loading}>
            {!loading && guild && (
                <>
                    <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h4" sx={{ mb: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2, color: 'grey.100' }}>
                                {moduleIcon}
                                {moduleTitle}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <ButtonGroup variant="outlined" sx={{ mr: 1 }}>
                                <Button
                                    component={Link}
                                    href={`/dashboard/twitch/${encodeURIComponent(guildId)}`}
                                    startIcon={<LiveTv />}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        bgcolor: moduleName === 'Twitch' ? '#9146FF' : 'grey.800',
                                        color: moduleName === 'Twitch' ? 'white' : 'grey.300',
                                        borderColor: 'grey.600',
                                        '&:hover': {
                                            bgcolor: moduleName === 'Twitch' ? '#7f37ff' : 'grey.700'
                                        }
                                    }}
                                >
                                    Twitch
                                </Button>
                                <Button
                                    component={Link}
                                    href={`/dashboard/tiktok/${encodeURIComponent(guildId)}`}
                                    startIcon={<LiveTv />}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        bgcolor: moduleName === 'TikTok' ? '#000000' : 'grey.800',
                                        color: moduleName === 'TikTok' ? 'white' : 'grey.300',
                                        borderColor: 'grey.600',
                                        '&:hover': {
                                            bgcolor: moduleName === 'TikTok' ? '#111111' : 'grey.700'
                                        }
                                    }}
                                >
                                    TikTok
                                </Button>
                                <Button
                                    component={Link}
                                    href={`/dashboard/youtube/${encodeURIComponent(guildId)}`}
                                    startIcon={<YouTubeIcon />}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        bgcolor: moduleName === 'YouTube' ? '#FF0000' : 'grey.800',
                                        color: moduleName === 'YouTube' ? 'white' : 'grey.300',
                                        borderColor: 'grey.600',
                                        '&:hover': {
                                            bgcolor: moduleName === 'YouTube' ? '#cc0000' : 'grey.700'
                                        }
                                    }}
                                >
                                    YouTube
                                </Button>
                                <Button
                                    component={Link}
                                    href={`/dashboard/patch-notes/${encodeURIComponent(guildId)}`}
                                    startIcon={<SpeakerNotes />}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        bgcolor: moduleName === 'Patch Notes' ? '#7C4DFF' : 'grey.800',
                                        color: moduleName === 'Patch Notes' ? 'white' : 'grey.300',
                                        borderColor: 'grey.600',
                                        '&:hover': {
                                            bgcolor: moduleName === 'Patch Notes' ? '#6b3afe' : 'grey.700'
                                        }
                                    }}
                                >
                                    Patch Notes
                                </Button>
                            </ButtonGroup>
                            <Button
                                component={Link}
                                href={`/dashboard/settings/${encodeURIComponent(guildId)}/notifications`}
                                variant="outlined"
                                size="small"
                                sx={{ borderColor: 'grey.600', color: 'grey.300', '&:hover': { borderColor: 'grey.500', bgcolor: 'grey.700' } }}
                            >
                                Back to Notifications
                            </Button>
                        </Stack>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3, bgcolor: 'error.dark', color: 'error.light' }} onClose={() => onSetError(null)}>
                            {error}
                        </Alert>
                    )}

                    <Paper elevation={2} sx={{
                        p: 3,
                        borderRadius: 2,
                        bgcolor: 'grey.800',
                        border: 1,
                        borderColor: 'grey.700'
                    }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'grey.100' }}>
                                Configured {moduleName} {plural}
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<Add />}
                                onClick={() => setAddDialogOpen(true)}
                                disabled={saving}
                                sx={{
                                    borderRadius: 2,
                                    bgcolor: moduleColor,
                                    '&:hover': { bgcolor: moduleColor, filter: 'brightness(0.9)' }
                                }}
                            >
                                Add {singular}
                            </Button>
                        </Box>

                        <NotificationConfigList
                            configs={configs}
                            channelNameField={channelNameField}
                            channelNameLabel={channelNameLabel}
                            getChannelName={getChannelName}
                            onEdit={setEditingConfig as any}
                            onDelete={handleDeleteConfig}
                            moduleName={moduleName}
                            saving={saving}
                            emptyStateIcon={moduleIcon as React.ReactElement & { props?: { sx?: SxProps<Theme> } }}
                            renderChip={renderChip}
                            itemSingularLabel={singular}
                            itemPluralLabel={plural}
                            canEdit={allowEdit}
                        />
                    </Paper>

                    <AddConfigDialog
                        open={addDialogOpen}
                        onClose={() => setAddDialogOpen(false)}
                        onAdd={onAdd}
                        channelNameField={channelNameField}
                        channelNameLabel={channelNameLabel}
                        channelNamePlaceholder={channelNamePlaceholder}
                        guildId={guildId as string}
                        moduleName={moduleName}
                        moduleColor={moduleColor}
                        channels={channels}
                        loadingChannels={loadingChannels}
                        saving={saving}
                        showCustomMessage={showCustomMessage}
                        itemSingularLabel={singular}
                        itemNameOptions={itemNameOptions}
                    />

                    <EditConfigDialog
                        open={!!editingConfig}
                        onClose={() => setEditingConfig(null)}
                        config={editingConfig}
                        onConfigChange={handleEditConfigChange}
                        onSave={handleUpdateConfig}
                        channelNameField={channelNameField}
                        channelNameLabel={channelNameLabel}
                        moduleName={moduleName}
                        moduleColor={moduleColor}
                        channels={channels}
                        loadingChannels={loadingChannels}
                        saving={saving}
                        itemSingularLabel={singular}
                        showCustomMessage={showCustomMessage}
                        itemNameOptions={itemNameOptions}
                    />
                </>
            )}
        </DashboardLayout>
    );
}
