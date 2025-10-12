import React from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Button,
  IconButton,
  Box
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";

interface ConfigCardProps {
  title: string;
  channelInfo: {
    label: string;
    value: string;
  };
  discordChannel: string;
  customMessage?: string;
  statusChip?: {
    label: string;
    color?: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
    variant?: "filled" | "outlined";
  };
  onEdit: () => void;
  onDelete: () => void;
  saving?: boolean;
  darkMode?: boolean;
  showEdit?: boolean;
}

export default function ConfigCard({
  title,
  channelInfo,
  discordChannel,
  customMessage,
  statusChip,
  onEdit,
  onDelete,
  saving = false,
  darkMode = true,
  showEdit = true,
}: ConfigCardProps) {
  return (
    <Card
      elevation={1}
      sx={{
        borderRadius: 2,
        height: '100%',
        bgcolor: darkMode ? 'grey.800' : 'white',
        border: darkMode ? 1 : 0,
        borderColor: darkMode ? 'grey.700' : 'transparent'
      }}
    >
      <CardContent>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            mb: 1,
            color: darkMode ? 'grey.100' : 'text.primary'
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mb: 1,
            color: darkMode ? 'grey.300' : 'text.secondary'
          }}
        >
          {channelInfo.label}: {channelInfo.value}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mb: 1,
            color: darkMode ? 'grey.300' : 'text.secondary'
          }}
        >
          Discord Channel: {discordChannel}
        </Typography>
        {customMessage && (
          <Typography
            variant="body2"
            sx={{
              mb: 1,
              color: darkMode ? 'grey.300' : 'text.secondary'
            }}
          >
            Custom Message: {customMessage}
          </Typography>
        )}
        {statusChip && (
          <Box sx={{ mt: 1 }}>
            <Chip
              label={statusChip.label}
              size="small"
              color={statusChip.color || "default"}
              variant={statusChip.variant || "outlined"}
            />
          </Box>
        )}
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        {showEdit && (
          <Button
            size="small"
            startIcon={<Edit />}
            onClick={onEdit}
            sx={{
              color: darkMode ? 'grey.300' : 'primary.main',
              '&:hover': {
                bgcolor: darkMode ? 'grey.700' : 'primary.light'
              }
            }}
          >
            Edit
          </Button>
        )}
        <IconButton
          color="error"
          size="small"
          onClick={onDelete}
          disabled={saving}
        >
          <Delete />
        </IconButton>
      </CardActions>
    </Card>
  );
}
