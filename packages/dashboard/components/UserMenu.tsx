import React from "react";
import {
  Box,
  Avatar,
  Button,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton
} from "@mui/material";
import { Logout, Person } from "@mui/icons-material";
import { useUserData } from "@/components/hooks/useUserData";

export default function UserMenu() {
  const {loading, getUserDisplayName, getUserAvatarUrl } = useUserData();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
    handleClose();
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: "grey.700" }} />
        <Skeleton variant="text" width={80} height={20} sx={{ bgcolor: "grey.700" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Button
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          color: "grey.300",
          textTransform: "none",
          borderRadius: 2,
          px: 1,
          py: 0.5,
          '&:hover': {
            bgcolor: "grey.700"
          }
        }}
      >
        <Avatar
          src={getUserAvatarUrl() || undefined}
          sx={{ width: 32, height: 32, bgcolor: "primary.main" }}
        >
          {getUserDisplayName().charAt(0)}
        </Avatar>
        <Typography variant="body2" sx={{ color: "grey.300" }}>
          {getUserDisplayName()}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            bgcolor: "grey.800",
            border: 1,
            borderColor: "grey.700",
            minWidth: 180
          }
        }}
      >
        <MenuItem onClick={handleClose} sx={{ color: "grey.300" }}>
          <ListItemIcon>
            <Person sx={{ color: "grey.400" }} />
          </ListItemIcon>
          <ListItemText primary="Profile" />
        </MenuItem>
        <MenuItem onClick={handleLogout} sx={{ color: "error.light" }}>
          <ListItemIcon>
            <Logout sx={{ color: "error.light" }} />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </MenuItem>
      </Menu>
    </Box>
  );
}
