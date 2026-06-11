import React from "react";
import { Box, FormControlLabel, Switch } from "@mui/material";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";

/**
 * Describes a single toggle item within a settings list.
 */
export interface SettingsToggleItem {
    label: string;
    defaultChecked?: boolean;
    disabled?: boolean;
}

/**
 * Props for SettingsToggleList.
 */
export interface SettingsToggleListProps {
    items: SettingsToggleItem[];
}

/**
 * Renders a vertical list of labeled Switch controls.
 */
export function SettingsToggleList({ items }: SettingsToggleListProps) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((item) => (
                <FormControlLabel
                    key={item.label}
                    control={<Switch defaultChecked={item.defaultChecked} disabled={item.disabled} sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: dashboardAccents.settings } }} />}
                    label={item.label}
                    sx={{ color: item.disabled ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.76)" }}
                />
            ))}
        </Box>
    );
}
