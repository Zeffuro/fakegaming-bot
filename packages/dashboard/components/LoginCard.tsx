import React from "react";
import {Box, Typography, Button, Link, Stack} from "@mui/material";
import FakegamingLogo from "@/components/FakegamingLogo";
import { DashboardLanguageSelector } from "@/components/i18n/DashboardLanguageSelector";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function LoginCard({isLoggedIn}: { isLoggedIn: boolean }) {
    const { t } = useDashboardI18n();
    return (
        <Box
            sx={{
                width: "100%",
                p: 3,
                borderRadius: 2,
                boxShadow: 3,
                bgcolor: "background.paper",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}
        >
            <Box sx={{ alignSelf: "stretch", display: "flex", justifyContent: "flex-end", mb: 1 }}>
                <DashboardLanguageSelector syncAccount={isLoggedIn} />
            </Box>
            <FakegamingLogo size={100} variant="circle" elevation={3}/>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, mt: 2 }}>
                {t("login.title")}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                {t("login.description")}
            </Typography>
            {isLoggedIn ? (
                <Link href="/dashboard" underline="none" sx={{width: "100%"}}>
                    <Button
                        variant="contained"
                        color="success"
                        size="large"
                        fullWidth
                        sx={{mt: 2, fontWeight: 600}}
                    >
                        {t("login.goToDashboard")}
                    </Button>
                </Link>
            ) : (
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    sx={{mt: 2, fontWeight: 600}}
                    onClick={() => window.location.href = "/api/auth/discord"}
                >
                    {t("login.withDiscord")}
                </Button>
            )}
            <Stack direction="row" spacing={1.5} sx={{ mt: 2, fontSize: 13 }}>
                <Link href="/privacy" underline="hover" sx={{ fontSize: 13 }}>
                    {t("nav.privacy")}
                </Link>
                <Link href="/terms" underline="hover" sx={{ fontSize: 13 }}>
                    {t("nav.terms")}
                </Link>
            </Stack>
        </Box>
    );
}
