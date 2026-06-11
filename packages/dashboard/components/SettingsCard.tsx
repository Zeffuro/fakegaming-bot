import React from "react";
import { Typography, Box } from "@mui/material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";

/**
 * SettingsCard standardizes the visual layout for a settings section.
 */
export interface SettingsCardProps {
    title: string;
    description?: React.ReactNode;
    children: React.ReactNode;
    accent?: string;
}

/**
 * Render a settings section card with a title, optional description, and content area.
 */
export function SettingsCard({ title, description, children, accent = dashboardAccents.settings }: SettingsCardProps) {
    return (
        <FeaturePanel accent={accent}>
            <Typography variant="h6" sx={{ mb: description ? 1.5 : 3, fontWeight: 850, color: "grey.50", position: "relative" }}>
                {title}
            </Typography>
            {description ? (
                <Typography variant="body2" sx={{ mb: 2, color: "rgba(255,255,255,0.58)", position: "relative" }}>
                    {description}
                </Typography>
            ) : null}
            <Box sx={{ position: "relative" }}>
                {children}
            </Box>
        </FeaturePanel>
    );
}
