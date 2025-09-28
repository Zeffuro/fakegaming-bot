import React from "react";
import {Card, CardActionArea, Box, Typography, CardContent} from "@mui/material";
import GuildAvatar from "./GuildAvatar";

export default function GuildCard({guild, onClick}: { guild: any, onClick: () => void }) {
    return (
        <Card>
            <CardActionArea onClick={onClick}>
                <Box sx={{display: "flex", alignItems: "center", p: 2}}>
                    <GuildAvatar guild={guild} enhanced/>
                    <Typography variant="subtitle1" sx={{ml: 2}}>
                        {guild.name}
                    </Typography>
                </Box>
                <CardContent>
                    <Typography variant="body2" color="text.secondary">
                        Click to manage
                    </Typography>
                </CardContent>
            </CardActionArea>
        </Card>
    );
}