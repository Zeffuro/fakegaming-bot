import React from "react";
import {Avatar} from "@mui/material";

export default function UserAvatar({user}: { user: { id: string; username: string; avatar?: string } }) {
    if (user.avatar) {
        return (
            <Avatar
                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                alt={user.username + " avatar"}
                sx={{width: 56, height: 56, marginBottom: 2}}
            />
        );
    }
    return (
        <Avatar sx={{width: 56, height: 56, marginBottom: 2, bgcolor: "#333"}}>
            {user.username[0]?.toUpperCase() ?? "?"}
        </Avatar>
    );
}

