"use client";
import React from "react";
import { AdminPage } from "@/components/AdminPage";
import { useAdminCards } from "@/components/hooks/useAdmin";
import { useRouter } from "next/navigation";
import { Box, Card, CardActionArea, CardContent, Grid, Stack, Typography } from "@mui/material";

export default function AdminHubPage() {
    const router = useRouter();
    const cards = useAdminCards();

    return (
        <AdminPage title="Admin Panel">
            <Box>
                <Grid container spacing={2}>
                    {cards.map((c) => (
                        <Grid key={c.href} sx={{ width: { xs: '100%', sm: '50%', md: '33.333%', lg: '25%' }, p: 1.5 }}>
                            <Card variant="outlined">
                                <CardActionArea onClick={() => router.push(c.href)}>
                                    <CardContent>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                            {c.icon}
                                            <Typography variant="h6">{c.title}</Typography>
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary">{c.description}</Typography>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </AdminPage>
    );
}
