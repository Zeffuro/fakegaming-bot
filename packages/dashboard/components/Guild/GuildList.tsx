import React from "react";
import {List, ListItem, ListItemAvatar, ListItemText, Paper} from "@mui/material";
import GuildAvatar from "./GuildAvatar";

export default function GuildList({guilds}: { guilds: { id: string; name: string; icon?: string }[] }) {
    return (
        <Paper elevation={2} sx={{mt: 2, bgcolor: "background.paper"}}>
            <List>
                {guilds.map(guild => (
                    <ListItem key={guild.id} sx={{mb: 1}}>
                        <ListItemAvatar>
                            <GuildAvatar guild={guild}/>
                        </ListItemAvatar>
                        <ListItemText primary={guild.name}/>
                    </ListItem>
                ))}
            </List>
        </Paper>
    );
}
