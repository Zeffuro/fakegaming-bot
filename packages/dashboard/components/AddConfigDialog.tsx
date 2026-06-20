import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    CircularProgress
} from "@mui/material";
import { dashboardDialogPaperSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import {
    ConfigDialogFields,
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
    saving: boolean;
    showCustomMessage?: boolean;
    itemSingularLabel?: string;
    itemNameOptions?: string[];
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
    saving,
    showCustomMessage = true,
    itemSingularLabel,
    itemNameOptions
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
    const handleFieldChange = (field: string, value: unknown) => {
        setNewConfig({ ...configValue, [field]: value });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: dashboardDialogPaperSx(moduleColor)
                }
            }}
        >
            <DialogTitle sx={{ color: 'grey.100', fontWeight: 850 }}>
                {itemSingularLabel ? `Add ${itemSingularLabel}` : `Add ${moduleName} ${moduleName === 'YouTube' ? 'Channel' : 'Streamer'}`}
            </DialogTitle>
            <DialogContent>
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
                    showCustomMessage={showCustomMessage}
                    itemNameOptions={itemNameOptions}
                />
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    disabled={saving}
                    sx={ghostActionButtonSx(moduleColor)}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleAddConfig}
                    variant="contained"
                    disabled={saving || !nameValue || !(newConfig as any).discordChannelId}
                    sx={primaryActionButtonSx(moduleColor)}
                >
                    {saving ? <CircularProgress size={20} /> : 'Add'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
