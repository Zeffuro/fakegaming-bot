import React, { useState } from "react";
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
import AddStreamingDialog from "@/components/AddStreamingDialog";
import EditStreamingDialog from "@/components/EditStreamingDialog";
import StreamingConfigList from "@/components/StreamingConfigList";
import { useStreamingForm, StreamingConfig } from "@/components/hooks/useStreamingForm";
import { useGuildChannels } from "@/components/hooks/useGuildChannels";

interface StreamingConfigPageProps<T extends StreamingConfig> {
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
}

export default function StreamingConfigPage<T extends StreamingConfig>({
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
  renderChip
}: StreamingConfigPageProps<T>) {
  const { channels, loading: loadingChannels, getChannelName } = useGuildChannels(guildId);

  const {
    addDialogOpen,
    setAddDialogOpen,
    editingConfig,
    setEditingConfig,
    handleAddConfig,
    handleUpdateConfig,
    handleDeleteConfig,
    handleChannelNameChange
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
      ...editingConfig,
      [field]: value
    });
  };

  return (
    <DashboardLayout guild={guild} currentModule={moduleName.toLowerCase()} maxWidth="lg" loading={loading}>
      {!loading && guild && (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2, color: 'grey.100' }}>
              {moduleIcon}
              {moduleTitle}
            </Typography>
            <Typography variant="body1" sx={{ color: 'grey.300' }}>
              Configure {moduleName} {moduleName === 'YouTube' ? 'channels' : 'streamers'} to automatically post notifications.
            </Typography>
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
                Configured {moduleName} {moduleName === 'YouTube' ? 'Channels' : 'Streamers'}
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
                Add {moduleName === 'YouTube' ? 'Channel' : 'Streamer'}
              </Button>
            </Box>

            <StreamingConfigList
              configs={configs}
              channelNameField={channelNameField}
              channelNameLabel={channelNameLabel}
              getChannelName={getChannelName}
              onEdit={setEditingConfig}
              onDelete={handleDeleteConfig}
              moduleName={moduleName}
              saving={saving}
              emptyStateIcon={moduleIcon as React.ReactElement & { props?: { sx?: SxProps<Theme> } }}
              renderChip={renderChip}
            />
          </Paper>

          {/* Add Dialog */}
          <AddStreamingDialog
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
          />

          {/* Edit Dialog */}
          <EditStreamingDialog
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
          />
        </>
      )}
    </DashboardLayout>
  );
}
