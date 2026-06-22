import React from "react";
import { ConfigDialogShell } from "@/components/config-dialog/ConfigDialogShell";
import {
    ConfigDialogFields,
    type ConfigDialogItemOption,
    getConfigStringValue,
    type ConfigDialogValue
} from "@/components/config-dialog/ConfigDialogFields";
import { useStreamingForm } from "@/components/hooks/useStreamingForm";
import type { StreamingConfig } from "@/components/hooks/useStreamingForm";

interface AddConfigDialogProps<T extends StreamingConfig> {
    open: boolean;
    onClose: () => void;
    onAdd: (config: Omit<T, 'id' | 'guildId'>) => Promise<boolean>;
    channelNameField: string;
    channelNameLabel: string;
    channelNamePlaceholder: string;
    guildId: string;
    moduleName: string;
    moduleColor: string;
    channels: { id: string; name: string }[];
    loadingChannels: boolean;
    onRefreshChannels?: () => Promise<void> | void;
    saving: boolean;
    showCustomMessage?: boolean;
    showNotificationControls?: boolean;
    itemSingularLabel?: string;
    itemNameOptions?: string[];
    itemNameSearch?: (query: string) => Promise<ConfigDialogItemOption[]>;
}

export default function AddConfigDialog<T extends StreamingConfig>({
    open,
    onClose,
    onAdd,
    channelNameField,
    channelNameLabel,
    channelNamePlaceholder,
    guildId,
    moduleName,
    moduleColor,
    channels,
    loadingChannels,
    onRefreshChannels,
    saving,
    showCustomMessage = true,
    showNotificationControls = true,
    itemSingularLabel,
    itemNameOptions,
    itemNameSearch
}: AddConfigDialogProps<T>) {
    const {
        newConfig,
        setNewConfig,
        handleAddConfig
    } = useStreamingForm<T>({
        onAdd,
        onUpdate: async () => false,
        onDelete: async () => false,
        channelNameField,
        guildId
    });

    const configValue = newConfig as ConfigDialogValue;
    const nameValue = getConfigStringValue(configValue, channelNameField);
    const selectedChannelId = getConfigStringValue(configValue, "discordChannelId");
    const handleFieldChange = (field: string, value: unknown) => {
        setNewConfig((current: ConfigDialogValue) => ({ ...current, [field]: value }));
    };
    const title = itemSingularLabel ? `Add ${itemSingularLabel}` : `Add ${moduleName} ${moduleName === 'YouTube' ? 'Channel' : 'Streamer'}`;

    return (
        <ConfigDialogShell
            open={open}
            onClose={onClose}
            title={title}
            moduleColor={moduleColor}
            saving={saving}
            submitLabel="Add"
            submitDisabled={!nameValue || !selectedChannelId}
            onSubmit={handleAddConfig}
        >
            <ConfigDialogFields
                value={configValue}
                onFieldChange={handleFieldChange}
                channelNameField={channelNameField}
                channelNameLabel={channelNameLabel}
                channelNamePlaceholder={channelNamePlaceholder}
                moduleName={moduleName}
                moduleColor={moduleColor}
                channels={channels}
                loadingChannels={loadingChannels}
                onRefreshChannels={onRefreshChannels}
                showCustomMessage={showCustomMessage}
                showNotificationControls={showNotificationControls}
                itemNameOptions={itemNameOptions}
                itemNameSearch={itemNameSearch}
            />
        </ConfigDialogShell>
    );
}
