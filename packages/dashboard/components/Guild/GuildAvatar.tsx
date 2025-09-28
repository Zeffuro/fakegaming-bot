import React from "react";
import BaseAvatar from "../BaseAvatar";

export default function GuildAvatar({
    guild,
    enhanced = false,
    size = 40
}: {
    guild: { id: string; name: string; icon?: string },
    enhanced?: boolean,
    size?: number
}) {
    const src = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
        : undefined;
    return (
        <BaseAvatar
            src={src}
            alt={guild.name + " icon"}
            size={size}
            bgcolor="#333"
            elevation={enhanced ? 3 : 1}
            sx={enhanced ? {border: "2px solid #5865F2"} : {}}
        >
            {!src && (guild.name[0]?.toUpperCase() ?? "?")}
        </BaseAvatar>
    );
}