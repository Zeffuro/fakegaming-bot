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
    const nameValue = getConfigStringValue(configValue, channelNameField);

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
                Edit {titleLabel}
            </DialogTitle>
            <DialogContent>
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
                    onClick={onSave}
                    variant="contained"
                    disabled={saving}
                    sx={primaryActionButtonSx(moduleColor)}
                >
                    {saving ? <CircularProgress size={20} /> : 'Update'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
