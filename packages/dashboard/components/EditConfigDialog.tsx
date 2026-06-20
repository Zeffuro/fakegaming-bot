import React from "react";
import { ConfigDialogShell } from "@/components/config-dialog/ConfigDialogShell";
import {
    ConfigDialogFields,
    type ConfigDialogValue
} from "@/components/config-dialog/ConfigDialogFields";
import { StreamingConfig } from "@/components/hooks/useStreamingForm";

interface EditConfigDialogProps<T extends StreamingConfig> {
    open: boolean;
    onClose: () => void;
    config: T | null;
    onConfigChange: (field: string, value: any) => void;
    onSave: () => Promise<boolean>;
    channelNameField: string;
    channelNameLabel: string;
    moduleName: string;
    moduleColor: string;
    channels: { id: string; name: string }[];
    loadingChannels: boolean;
    saving: boolean;
    itemSingularLabel?: string;
    showCustomMessage?: boolean;
    itemNameOptions?: string[];
}

export default function EditConfigDialog<T extends StreamingConfig>({
    open,
    onClose,
    config,
    onConfigChange,
    onSave,
    channelNameField,
    channelNameLabel,
    moduleName,
    moduleColor,
    channels,
    loadingChannels,
    saving,
    itemSingularLabel,
    showCustomMessage = true,
    itemNameOptions
}: EditConfigDialogProps<T>) {
    if (!config) return null;

    const configValue = config as unknown as ConfigDialogValue;
    const titleLabel = itemSingularLabel ?? (moduleName === 'YouTube' ? 'Channel' : 'Streamer');

    return (
        <ConfigDialogShell
            open={open}
            onClose={onClose}
            title={`Edit ${titleLabel}`}
            moduleColor={moduleColor}
            saving={saving}
            submitLabel="Update"
            onSubmit={onSave}
        >
            <ConfigDialogFields
                value={configValue}
                onFieldChange={onConfigChange}
                channelNameField={channelNameField}
                channelNameLabel={channelNameLabel}
                moduleName={moduleName}
                moduleColor={moduleColor}
                channels={channels}
                loadingChannels={loadingChannels}
                showCustomMessage={showCustomMessage}
                itemNameOptions={itemNameOptions}
            />
        </ConfigDialogShell>
    );
}
