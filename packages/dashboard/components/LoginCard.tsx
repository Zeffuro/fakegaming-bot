import React from "react";
import {Box, Typography, Button, Link} from "@mui/material";
import FakegamingLogo from "@/components/FakegamingLogo";

export default function LoginCard({isLoggedIn}: { isLoggedIn: boolean }) {
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
            <FakegamingLogo size={100} variant="circle" elevation={3}/>
            <Typography variant="h4" fontWeight={700} mb={2} mt={2}>
                Fakegaming Bot Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={4}>
                Log in with Discord to manage your servers and bot settings.
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
                        Go to Dashboard
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
                    Login with Discord
                </Button>
            )}
        </Box>
    );
}