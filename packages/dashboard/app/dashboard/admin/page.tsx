"use client";
import React from "react";
import { AdminPage } from "@/components/AdminPage";
import { useAdminCards } from "@/components/hooks/useAdmin";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { Box } from "@mui/material";

export default function AdminHubPage() {
    const cards = useAdminCards();

    return (
        <AdminPage title="Admin panel">
            <FeaturePanel accent={dashboardAccents.admin}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2, position: "relative" }}>
                    {cards.map((card) => (
                        <FeatureCard
                            key={card.href}
                            title={card.title}
                            description={card.description}
                            icon={card.icon}
                            accent={dashboardAccents.admin}
                            href={card.href}
                            statusLabel="admin"
                            actionLabel="Open"
                        />
                    ))}
                </Box>
            </FeaturePanel>
        </AdminPage>
    );
}
