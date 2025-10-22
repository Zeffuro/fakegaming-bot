"use client";
import React from "react";
import {
    Typography, Box, Alert, Button, Stack
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
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{mb: 3}}>
                        <Typography variant="h4" sx={{ fontWeight: 600 }}>
                            Your Guilds {isAdmin && <span style={{color: "gold"}}>(Full Access)</span>}
                        </Typography>
                        {isAdmin && (
                            <Button variant="contained" color="primary" onClick={() => router.push('/dashboard/admin')}>
                                Admin Panel
                            </Button>
                        )}
                    </Stack>
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