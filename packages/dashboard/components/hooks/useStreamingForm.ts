import { useState } from "react";
import { SelectChangeEvent } from "@mui/material";

export interface StreamingConfig {
  id?: number;
  discordChannelId: string;
  guildId: string;
  customMessage?: string;
}

interface UseStreamingFormProps<T extends StreamingConfig> {
  onAdd: (config: Omit<T, 'id' | 'guildId'>) => Promise<boolean>;
  onUpdate: (config: T) => Promise<boolean>;
  onDelete: (config: T) => Promise<boolean>;
  channelNameField: string;
  guildId: string;
}

export function useStreamingForm<T extends StreamingConfig>({
  onAdd,
  onUpdate,
  onDelete,
  channelNameField,
  guildId
}: UseStreamingFormProps<T>) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<T | null>(null);
  const [newConfig, setNewConfig] = useState<any>({
    [channelNameField]: '',
    discordChannelId: '',
    customMessage: ''
  });

  const handleAddConfig = async () => {
    const success = await onAdd(newConfig);
    if (success) {
      setNewConfig({
        [channelNameField]: '',
        discordChannelId: '',
        customMessage: ''
      });
      setAddDialogOpen(false);
    }
  };

  const handleUpdateConfig = async () => {
    if (!editingConfig) return false;
    const success = await onUpdate(editingConfig);
    if (success) {
      setEditingConfig(null);
    }
    return success;
  };

  const handleDeleteConfig = async (config: T) => {
    if (!confirm(`Are you sure you want to delete this configuration?`)) {
      return false;
    }
    return await onDelete(config);
  };

  const handleChannelChange = (event: SelectChangeEvent<string>, isEdit: boolean = false) => {
    const channelId = event.target.value;
    if (isEdit && editingConfig) {
      setEditingConfig({ ...editingConfig, discordChannelId: channelId });
    } else {
      setNewConfig({ ...newConfig, discordChannelId: channelId });
    }
  };

  const handleChannelNameChange = (value: string, isEdit: boolean = false) => {
    if (isEdit && editingConfig) {
      setEditingConfig({ ...editingConfig, [channelNameField]: value });
    } else {
      setNewConfig({ ...newConfig, [channelNameField]: value });
    }
  };

  const handleCustomMessageChange = (value: string, isEdit: boolean = false) => {
    if (isEdit && editingConfig) {
      setEditingConfig({ ...editingConfig, customMessage: value });
    } else {
      setNewConfig({ ...newConfig, customMessage: value });
    }
  };

  const resetForm = () => {
    setNewConfig({
      [channelNameField]: '',
      discordChannelId: '',
      customMessage: ''
    });
  };

  return {
    addDialogOpen,
    setAddDialogOpen,
    editingConfig,
    setEditingConfig,
    newConfig,
    setNewConfig,
    handleAddConfig,
    handleUpdateConfig,
    handleDeleteConfig,
    handleChannelChange,
    handleChannelNameChange,
    handleCustomMessageChange,
    resetForm
  };
}
