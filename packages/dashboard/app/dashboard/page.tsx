"use client";
import React, {useState} from "react";
import {
    Typography, Box, Container
} from "@mui/material";
import TopBar from "../../components/TopBar/TopBar";
import GuildCard from "@/components/Guild/GuildCard";
import GuildModal from "@/components/Guild/GuildModal";

import {useDashboardData} from "@/components/hooks/useDashboardData";

export default function Dashboard() {
    const {user, guilds, loading, isAdmin} = useDashboardData();
    const [selectedGuild, setSelectedGuild] = useState<any>(null);

    if (loading) return <Box sx={{p: 4}}><Typography>Loading dashboard...</Typography></Box>;
    if (!user) return null;

    return (
        <>
            <TopBar user={user}/>
            <Container maxWidth="lg">
                <Typography variant="h5" sx={{mb: 2}}>
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
                        <GuildCard key={guild.id} guild={guild} onClick={() => setSelectedGuild(guild)}/>
                    ))}
                </Box>
                <GuildModal guild={selectedGuild} open={!!selectedGuild} onClose={() => setSelectedGuild(null)}/>
            </Container>
        </>
    );
}