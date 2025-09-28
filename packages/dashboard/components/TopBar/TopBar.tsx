import React from "react";
import {AppBar, Toolbar, Typography, Button, Box} from "@mui/material";
import FakegamingLogo from "../FakegamingLogo";
import UserAvatar from "../User/UserAvatar";

export default function TopBar({user}: { user: any }) {
    return (
        <AppBar
            position="static"
            color="primary"
            elevation={2}
            sx={{
                mb: 4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
        >
            <Toolbar sx={{minHeight: 50, py: 0.5}}>
                <FakegamingLogo size={36}/>
                <Typography variant="h6" sx={{flexGrow: 1, ml: 2}}>
                    Fakegaming Dashboard
                </Typography>
                <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                    <UserAvatar size={36} user={{...user, avatar: user.avatar}}/>
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 500,
                            color: "text.primary",
                            px: 2,
                            py: 0.5,
                            bgcolor: "background.paper",
                            borderRadius: 2,
                            boxShadow: 1,
                            fontSize: "1rem",
                            letterSpacing: 0.5,
                        }}
                    >
                        {user.username}
                    </Typography>
                    <Button
                        color="error"
                        variant="outlined"
                        onClick={() => window.location.href = "/api/auth/logout"}
                        sx={{ml: 1}}
                    >
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}