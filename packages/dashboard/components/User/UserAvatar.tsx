import React from "react";
import BaseAvatar from "../BaseAvatar";

export default function UserAvatar({user, size = 32}: {
    user: { id: string; username: string; avatar?: string },
    size?: number
}) {
    const src = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : undefined;
    return (
        <BaseAvatar
            src={src}
            alt={user.username + " avatar"}
            size={size}
            bgcolor="#333"
        >
            {!src && (user.username[0]?.toUpperCase() ?? "?")}
        </BaseAvatar>
    );
}