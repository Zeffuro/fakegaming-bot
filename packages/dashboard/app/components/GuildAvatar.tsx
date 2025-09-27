import React from "react";
import {Avatar} from "@mui/material";

export default function GuildAvatar({guild}: { guild: { id: string; name: string; icon?: string } }) {
    if (guild.icon) {
        return (
            <Avatar
                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                alt={guild.name + " icon"}
                sx={{width: 40, height: 40, marginRight: 2}}
            />
        );
    }
    return (
        <Avatar sx={{width: 40, height: 40, marginRight: 2, bgcolor: "#333"}}>
            {guild.name[0]?.toUpperCase() ?? "?"}
        </Avatar>
    );
}

