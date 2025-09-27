"use client";
import React, {useEffect, useState} from "react";
import {Box, Button, Typography} from "@mui/material";
import UserAvatar from "../components/UserAvatar";
import GuildList from "../components/GuildList";

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [guilds, setGuilds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            // Fetch user info
            const userRes = await fetch("/api/auth/me", {method: "PUT"});
            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData.user);
                // Fetch guilds
                const guildRes = await fetch("/api/guilds");
                if (guildRes.ok) {
                    const guildData = await guildRes.json();
                    setGuilds(guildData.guilds);
                    setIsAdmin(guildData.isAdmin);
                }
            } else {
                // Redirect to root if not authenticated
                window.location.href = "/";
                return;
            }
            setLoading(false);
        }

        fetchData();
    }, []);

    if (loading) return <Box sx={{p: 4}}><Typography>Loading dashboard...</Typography></Box>;
    if (!user) return null;

    return (
        <Box sx={{p: 4, maxWidth: 600, mx: "auto"}}>
            <Typography variant="h4" sx={{mb: 1}}>Welcome, {user.username}!</Typography>
            <Typography sx={{mb: 3}}>Manage your servers and bot settings below.</Typography>
            <UserAvatar user={user}/>
            <Typography variant="h5" sx={{mt: 4}}>
                Your Guilds {isAdmin && <span style={{color: "gold"}}>(Full Access)</span>}
            </Typography>
            <GuildList guilds={guilds}/>
            <Button
                variant="contained"
                color="primary"
                sx={{mt: 4, fontSize: 16, borderRadius: 2}}
                onClick={() => {
                    window.location.href = "/api/auth/logout";
                }}
            >
                Logout
            </Button>
        </Box>
    );
}
