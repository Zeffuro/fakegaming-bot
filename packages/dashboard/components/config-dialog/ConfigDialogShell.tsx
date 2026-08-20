import React, { type ReactNode } from "react";
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle
} from "@mui/material";
import { dashboardDialogPaperSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface ConfigDialogShellProps {
    open: boolean;
    onClose: () => void;
    title: string;
    moduleColor: string;
    saving: boolean;
    submitLabel: string;
    submitDisabled?: boolean;
    onSubmit: () => Promise<unknown> | void;
    children: ReactNode;
}

export function ConfigDialogShell({
    open,
    onClose,
    title,
    moduleColor,
    saving,
    submitLabel,
    submitDisabled = false,
    onSubmit,
    children
}: ConfigDialogShellProps) {
    const { t } = useDashboardI18n();
    const handleSubmit = () => {
        void onSubmit();
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
            <DialogTitle sx={{ color: "grey.100", fontWeight: 850 }}>
                {title}
            </DialogTitle>
            <DialogContent>
                {children}
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    disabled={saving}
                    sx={ghostActionButtonSx(moduleColor)}
                >
                    {t("common.cancel")}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={saving || submitDisabled}
                    sx={primaryActionButtonSx(moduleColor)}
                >
                    {saving ? <CircularProgress size={20} /> : submitLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
