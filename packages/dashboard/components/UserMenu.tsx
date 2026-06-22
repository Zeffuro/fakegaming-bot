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
import { AdminPanelSettings, Logout, Person } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { useAdminAccess } from "@/components/hooks/useAdmin";
import { useUserData } from "@/components/hooks/useUserData";

export default function UserMenu() {
  const router = useRouter();
  const {loading, getUserDisplayName, getUserAvatarUrl } = useUserData();
  const { isAdmin } = useAdminAccess();
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

  const handleAdmin = () => {
    router.push("/dashboard/admin");
    handleClose();
  };

  const handleProfile = () => {
    router.push("/dashboard/me");
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
          color: "grey.100",
          textTransform: "none",
          borderRadius: 999,
          px: { xs: 0.5, sm: 1 },
          py: 0.55,
          border: "1px solid rgba(255,255,255,0.10)",
          bgcolor: "rgba(255,255,255,0.045)",
          '&:hover': {
            bgcolor: "rgba(255,255,255,0.08)",
            borderColor: alpha("#68D7FF", 0.35)
          }
        }}
      >
        <Avatar
          src={getUserAvatarUrl() || undefined}
          sx={{ width: 32, height: 32, bgcolor: "primary.main", border: "1px solid rgba(255,255,255,0.18)" }}
        >
          {getUserDisplayName().charAt(0)}
        </Avatar>
        <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750, display: { xs: "none", sm: "block" } }}>
          {getUserDisplayName()}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(18,24,34,0.98)",
              border: "1px solid rgba(255,255,255,0.10)",
              minWidth: 180,
              borderRadius: 3,
              boxShadow: "0 24px 70px rgba(0,0,0,0.42)"
            }
          }
        }}
      >
        <MenuItem onClick={handleProfile} sx={{ color: "grey.300" }}>
          <ListItemIcon>
            <Person sx={{ color: "grey.400" }} />
          </ListItemIcon>
          <ListItemText primary="Your dashboard" />
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={handleAdmin} sx={{ color: "grey.200" }}>
            <ListItemIcon>
              <AdminPanelSettings sx={{ color: "grey.300" }} />
            </ListItemIcon>
            <ListItemText primary="Admin Panel" />
          </MenuItem>
        )}
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
