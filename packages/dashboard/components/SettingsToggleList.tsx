import React from "react";
import { Box, FormControlLabel, Switch } from "@mui/material";

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
                    control={<Switch defaultChecked={item.defaultChecked} disabled={item.disabled} />}
                    label={item.label}
                />
            ))}
        </Box>
    );
}
