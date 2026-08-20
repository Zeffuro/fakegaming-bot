import React from "react";
import { ConfigDialogShell } from "@/components/config-dialog/ConfigDialogShell";
import {
    ConfigDialogFields,
    type ConfigDialogItemOption,
    type ConfigDialogValue
} from "@/components/config-dialog/ConfigDialogFields";
import { StreamingConfig } from "@/components/hooks/useStreamingForm";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface EditConfigDialogProps<T extends StreamingConfig> {
    open: boolean;
    onClose: () => void;
    config: T | null;
    onConfigChange: (field: string, value: any) => void;
    onSave: () => Promise<boolean>;
    channelNameField: string;
    channelNameLabel: string;
    moduleName: string;
    moduleDisplayName?: string;
    moduleColor: string;
    channels: { id: string; name: string }[];
    loadingChannels: boolean;
    onRefreshChannels?: () => Promise<void> | void;
    saving: boolean;
    itemSingularLabel?: string;
    showCustomMessage?: boolean;
    showNotificationControls?: boolean;
    itemNameOptions?: string[];
    itemNameSearch?: (query: string) => Promise<ConfigDialogItemOption[]>;
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
    moduleDisplayName = moduleName,
    moduleColor,
    channels,
    loadingChannels,
    onRefreshChannels,
    saving,
    itemSingularLabel,
    showCustomMessage = true,
    showNotificationControls = true,
    itemNameOptions,
    itemNameSearch
}: EditConfigDialogProps<T>) {
    const { t } = useDashboardI18n();
    if (!config) return null;

    const configValue = config as unknown as ConfigDialogValue;
    const titleLabel = itemSingularLabel ?? (moduleName === "YouTube" ? t("config.channel") : t("config.streamer"));

    return (
        <ConfigDialogShell
            open={open}
            onClose={onClose}
            title={t("common.editItem", { item: titleLabel })}
            moduleColor={moduleColor}
            saving={saving}
            submitLabel={t("common.update")}
            onSubmit={onSave}
        >
            <ConfigDialogFields
                value={configValue}
                onFieldChange={onConfigChange}
                channelNameField={channelNameField}
                channelNameLabel={channelNameLabel}
                moduleName={moduleName}
                moduleDisplayName={moduleDisplayName}
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
