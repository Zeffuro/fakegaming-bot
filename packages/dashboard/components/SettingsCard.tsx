import React from "react";
import { Paper, Typography, Box } from "@mui/material";

/**
 * SettingsCard standardizes the visual layout for a settings section.
 */
export interface SettingsCardProps {
    title: string;
    description?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * Render a settings section card with a title, optional description, and content area.
 */
export function SettingsCard({ title, description, children }: SettingsCardProps) {
    return (
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: description ? 1.5 : 3, fontWeight: 600 }}>
                {title}
            </Typography>
            {description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {description}
                </Typography>
            ) : null}
            <Box>
                {children}
            </Box>
        </Paper>
    );
}
