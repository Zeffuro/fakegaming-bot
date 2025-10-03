"use client";
import React from "react";
import {
    Typography, Box, Alert
} from "@mui/material";
import GuildCard from "@/components/Guild/GuildCard";
import DashboardLayout from "@/components/DashboardLayout";
import { useRouter } from "next/navigation";
import {useDashboardData} from "@/components/hooks/useDashboardData";

export default function Dashboard() {
    const {guilds, isAdmin, loading, error} = useDashboardData();
    const router = useRouter();

    const handleGuildClick = (guild: any) => {
        router.push(`/dashboard/${guild.id}`);
    };

    if (error) {
        return (
            <DashboardLayout>
                <Alert severity="error">{error}</Alert>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout loading={loading}>
            {!loading && (
                <>
                    <Typography variant="h4" sx={{mb: 4, fontWeight: 600}}>
                        Your Guilds {isAdmin && <span style={{color: "gold"}}>(Full Access)</span>}
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr", lg: "1fr 1fr 1fr 1fr"},
                            gap: 3,
                        }}
                    >
                        {guilds.map(guild => (
                            <GuildCard key={guild.id} guild={guild} onClick={() => handleGuildClick(guild)}/>
                        ))}
                    </Box>
                </>
            )}
        </DashboardLayout>
    );
}