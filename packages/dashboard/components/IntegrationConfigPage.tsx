"use client";
import React from "react";
import { Alert } from "@mui/material";
import DashboardLayout from "@/components/DashboardLayout";
import NotificationConfigPage from "@/components/NotificationConfigPage";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import type { StreamingConfig } from "@/components/hooks/useStreamingForm";

/**
 * Shape returned from provider-specific config hooks used by IntegrationConfigPage.
 */
export interface ConfigHookResult<T extends StreamingConfig> {
    configs: T[];
    loading: boolean;
    saving: boolean;
    error: string | null;
    setError: (error: string | null) => void;
    addConfig: (config: Omit<T, 'id' | 'guildId'>) => Promise<boolean>;
    updateConfig: (config: T) => Promise<boolean>;
    deleteConfig: (config: T) => Promise<boolean>;
}

/**
 * Props for IntegrationConfigPage, a generic wrapper for integration configuration UIs.
 */
export interface IntegrationConfigPageProps<T extends StreamingConfig> {
    // Provider-specific hook that returns configs and CRUD handlers for the given guild
    useConfigs: (guildId: string) => ConfigHookResult<T>;

    // Optionally provide a pre-bound configs API to avoid duplicate hook calls in the page
    configsApi?: ConfigHookResult<T>;

    // Visuals and labels
    moduleTitle: string;
    moduleIcon: React.ReactNode;
    moduleColor: string;
    moduleName: string;

    // Field mapping for the primary identifier (username/channel/game, etc.)
    channelNameField: string;
    channelNameLabel: string;
    channelNamePlaceholder: string;

    // Optional customizations forwarded to NotificationConfigPage
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

/**
 * IntegrationConfigPage
 * A reusable Next.js client component that handles guild resolution, not-found display,
 * and wiring of provider-specific config hooks into the shared NotificationConfigPage UI.
 *
 * It reduces duplication across integration pages by encapsulating the shared layout
 * and CRUD binding logic while allowing provider-specific labels and behaviors via props.
 */
export function IntegrationConfigPage<T extends StreamingConfig>({
    useConfigs,
    configsApi,
    moduleTitle,
    moduleIcon,
    moduleColor,
    moduleName,
    channelNameField,
    channelNameLabel,
    channelNamePlaceholder,
    renderChip,
    itemSingularLabel,
    itemPluralLabel,
    showCustomMessage,
    itemNameOptions,
    allowEdit
}: IntegrationConfigPageProps<T>) {
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const api = configsApi ?? useConfigs(guildId as string);
    const {
        configs,
        loading,
        saving,
        error,
        setError,
        addConfig,
        updateConfig,
        deleteConfig
    } = api;

    if (!guild && !guildsLoading) {
        return (
            <DashboardLayout>
                <Alert severity="error" sx={{ bgcolor: 'error.dark', color: 'error.light' }}>
                    Guild not found or you don't have access to this guild.
                </Alert>
            </DashboardLayout>
        );
    }

    return (
        <NotificationConfigPage<T>
            guildId={guildId as string}
            guild={guild}
            configs={configs}
            loading={loading || guildsLoading}
            saving={saving}
            error={error}
            moduleTitle={moduleTitle}
            moduleIcon={moduleIcon}
            moduleColor={moduleColor}
            moduleName={moduleName}
            channelNameField={channelNameField}
            channelNameLabel={channelNameLabel}
            channelNamePlaceholder={channelNamePlaceholder}
            onSetError={setError}
            onAdd={addConfig}
            onUpdate={updateConfig}
            onDelete={deleteConfig}
            renderChip={renderChip}
            itemSingularLabel={itemSingularLabel}
            itemPluralLabel={itemPluralLabel}
            showCustomMessage={showCustomMessage}
            itemNameOptions={itemNameOptions}
            allowEdit={allowEdit}
        />
    );
}
