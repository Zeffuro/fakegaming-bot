"use client";
import React from "react";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import {
  Box,
  Typography,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Avatar,
  Chip,
  Paper
} from "@mui/material";
import {
  YouTube,
  Settings,
  Block,
  SpeakerNotes,
  Timeline,
  LiveTv,
  FormatQuote
} from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { useRouter } from "next/navigation";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "active" | "inactive" | "beta";
  href: string;
  disabled?: boolean;
}

function ModuleCard({ title, description, icon, status, href, disabled }: ModuleCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (!disabled) {
      router.push(href);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "active": return "success";
      case "inactive": return "default";
      case "beta": return "warning";
      default: return "default";
    }
  };

  return (
    <Card
      elevation={2}
      sx={{
        height: '100%',
        borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease-in-out',
        bgcolor: 'grey.800',
        border: 1,
        borderColor: 'grey.700',
        '&:hover': disabled ? {} : {
          transform: 'translateY(-2px)',
          boxShadow: 6,
          borderColor: 'grey.600'
        }
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
            {icon}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'grey.100' }}>
              {title}
            </Typography>
            <Chip
              label={status}
              size="small"
              color={getStatusColor() as any}
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          </Box>
        </Box>
        <Typography variant="body2" sx={{ color: 'grey.300' }}>
          {description}
        </Typography>
      </CardContent>
      <CardActions sx={{ pt: 0 }}>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled}
          fullWidth
          sx={{
            borderColor: disabled ? 'grey.600' : 'primary.main',
            color: disabled ? 'grey.500' : 'primary.light',
            '&:hover': disabled ? {} : {
              borderColor: 'primary.light',
              bgcolor: 'primary.dark'
            }
          }}
        >
          {disabled ? 'Coming Soon' : 'Configure'}
        </Button>
      </CardActions>
    </Card>
  );
}

export default function GuildDashboard() {
  const { guildId } = useParams();
  const { guilds } = useDashboardData();
  const guild = guilds.find(g => g.id === guildId);

  if (!guild) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ bgcolor: 'error.dark', color: 'error.light' }}>
          Guild not found or you don't have access to this guild.
        </Alert>
      </DashboardLayout>
    );
  }

  const modules: ModuleCardProps[] = [
    {
      title: "Quotes Management",
      description: "View, add, search, and delete quotes stored for your server.",
      icon: <FormatQuote />,
      status: "active",
      href: `/dashboard/quotes/${guildId}`
    },
    {
      title: "YouTube Notifications",
      description: "Configure YouTube channels to automatically post notifications when new videos are uploaded.",
      icon: <YouTube />,
      status: "active",
      href: `/dashboard/youtube/${guildId}`
    },
    {
      title: "Twitch Integration",
      description: "Configure Twitch stream notifications and live alerts.",
      icon: <LiveTv />,
      status: "active",
      href: `/dashboard/twitch/${guildId}`
    },
    {
      title: "Server Settings",
      description: "Configure bot behavior, permissions, and general server settings.",
      icon: <Settings />,
      status: "active",
      href: `/dashboard/settings/${guildId}`
    },
    {
      title: "Command Management",
      description: "Enable or disable specific bot commands for your server.",
      icon: <Block />,
      status: "active",
      href: `/dashboard/commands/${guildId}`
    },
    {
      title: "Patch Notes",
      description: "Manage game patch note notifications and subscriptions.",
      icon: <SpeakerNotes />,
      status: "beta",
      href: `/dashboard/patch-notes/${guildId}`
    },
    {
      title: "Analytics",
      description: "View server activity, member engagement, and bot usage statistics.",
      icon: <Timeline />,
      status: "inactive",
      href: `/dashboard/analytics/${guildId}`,
      disabled: true
    }
  ];

  return (
    <DashboardLayout guild={guild} currentModule={null} maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, color: 'grey.100' }}>
          {guild.name} Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'grey.300' }}>
          Manage and configure bot features for your server.
        </Typography>
      </Box>

      <Paper elevation={1} sx={{
        p: 3,
        mb: 4,
        borderRadius: 2,
        bgcolor: 'grey.800',
        border: 1,
        borderColor: 'grey.700'
      }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'grey.100' }}>
          Quick Stats
        </Typography>
        <Grid container spacing={2}>
          <Grid sx={{ width: { xs: '50%', sm: '25%' } }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.light' }}>
                {guild.member_count || 'N/A'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'grey.400' }}>
                Members
              </Typography>
            </Box>
          </Grid>
          <Grid sx={{ width: { xs: '50%', sm: '25%' } }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'success.light' }}>
                {modules.filter(m => m.status === 'active' && !m.disabled).length}
              </Typography>
              <Typography variant="body2" sx={{ color: 'grey.400' }}>
                Active Modules
              </Typography>
            </Box>
          </Grid>
          <Grid sx={{ width: { xs: '50%', sm: '25%' } }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'warning.light' }}>
                {modules.filter(m => m.status === 'beta').length}
              </Typography>
              <Typography variant="body2" sx={{ color: 'grey.400' }}>
                Beta Features
              </Typography>
            </Box>
          </Grid>
          <Grid sx={{ width: { xs: '50%', sm: '25%' } }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'grey.500' }}>
                {modules.filter(m => m.disabled).length}
              </Typography>
              <Typography variant="body2" sx={{ color: 'grey.400' }}>
                Coming Soon
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'grey.100' }}>
        Available Modules
      </Typography>

      <Grid container spacing={3}>
        {modules.map((module, index) => (
          <Grid sx={{ width: { xs: '100%', sm: '50%', md: '33.333%' }, p: 1.5 }} key={index}>
            <ModuleCard {...module} />
          </Grid>
        ))}
      </Grid>
    </DashboardLayout>
  );
}
