import React from "react";
import {Avatar, Box} from "@mui/material";

interface BaseAvatarProps {
    src?: string;
    alt?: string;
    size?: number;
    children?: React.ReactNode;
    sx?: object;
    variant?: "circle" | "square";
    elevation?: number;
    bgcolor?: string;
}

export default function BaseAvatar({
    src,
    alt,
    size = 40,
    children,
    sx = {},
    variant = "circle",
    elevation = 3,
    bgcolor = "#333"
}: BaseAvatarProps) {
    return (
        <Box
            sx={{
                width: size,
                height: size,
                borderRadius: variant === "circle" ? "50%" : 2,
                overflow: "hidden",
                boxShadow: elevation,
                bgcolor,
                ...sx,
            }}
        >
            {src ? (
                <Avatar src={src} alt={alt} sx={{width: size, height: size, bgcolor: "transparent"}} />
            ) : (
                <Avatar sx={{width: size, height: size, bgcolor}}>{children}</Avatar>
            )}
        </Box>
    );
}