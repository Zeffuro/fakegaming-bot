"use client";
import React from "react";
import { Box, Container, Link, Stack, Typography } from "@mui/material";

const cookieRows = [
    {
        name: "jwt",
        purpose: "Keeps the dashboard authenticated for API requests.",
        duration: "20 minutes"
    },
    {
        name: "refresh_session",
        purpose: "Keeps a dashboard login active across idle periods and lets logout revoke the session.",
        duration: "14 days idle, 30 days maximum"
    },
    {
        name: "csrf",
        purpose: "Protects mutating dashboard requests against cross-site request forgery.",
        duration: "14 days"
    }
] as const;

export default function PrivacyPage() {
    return (
        <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
            <Stack spacing={4}>
                <Box>
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 850, mb: 1 }}>
                        Privacy and cookies
                    </Typography>
                    <Typography color="text.secondary">
                        Fakegaming Bot Dashboard uses Discord login to verify which servers you can manage.
                    </Typography>
                </Box>

                <Stack spacing={1.5}>
                    <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
                        Cookies
                    </Typography>
                    <Typography>
                        The dashboard only uses cookies needed for login and request security. It does not use advertising,
                        tracking, or analytics cookies.
                    </Typography>
                    <Stack spacing={1.5}>
                        {cookieRows.map(cookie => (
                            <Box
                                key={cookie.name}
                                sx={{
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: 2,
                                    p: 2,
                                    bgcolor: "background.paper"
                                }}
                            >
                                <Typography sx={{ fontWeight: 800 }}>{cookie.name}</Typography>
                                <Typography color="text.secondary">{cookie.purpose}</Typography>
                                <Typography variant="body2" color="text.secondary">Duration: {cookie.duration}</Typography>
                            </Box>
                        ))}
                    </Stack>
                </Stack>

                <Stack spacing={1.5}>
                    <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
                        Discord data
                    </Typography>
                    <Typography>
                        During login, the dashboard reads your Discord user profile and server list so it can show servers
                        where you have permission to manage the bot. Discord access tokens are stored server-side and used
                        only to refresh that server list.
                    </Typography>
                </Stack>

                <Box>
                    <Link href="/" underline="hover">Back to login</Link>
                </Box>
            </Stack>
        </Container>
    );
}

