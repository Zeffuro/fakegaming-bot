import React from "react";
import {
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Typography,
  Box,
  Chip
} from "@mui/material";
import { People, AdminPanelSettings } from "@mui/icons-material";
import { DISCORD_PERMISSION_ADMINISTRATOR } from "@/lib/constants";

interface GuildCardProps {
  guild: {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    member_count?: number;
  };
  onClick: () => void;
}

export default function GuildCard({ guild, onClick }: GuildCardProps) {
  const getGuildIcon = () => {
    if (guild.icon) {
      return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
    }
    return undefined;
  };

  const isAdmin = guild.owner || (guild.permissions && (parseInt(guild.permissions) & DISCORD_PERMISSION_ADMINISTRATOR));

  return (
    <Card
      elevation={2}
      sx={{
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6
        }
      }}
    >
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Avatar
            src={getGuildIcon()}
            sx={{
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 2,
              fontSize: 24,
              fontWeight: 600
            }}
          >
            {guild.name?.charAt(0)}
          </Avatar>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {guild.name}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
            {guild.owner && (
              <Chip
                icon={<AdminPanelSettings />}
                label="Owner"
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {!guild.owner && isAdmin && (
              <Chip
                icon={<AdminPanelSettings />}
                label="Admin"
                size="small"
                color="secondary"
                variant="outlined"
              />
            )}
          </Box>

          {guild.member_count && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
              <People sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {guild.member_count.toLocaleString()} members
              </Typography>
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
