import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  SelectChangeEvent
} from "@mui/material";
import { useStreamingForm } from "@/components/hooks/useStreamingForm";
import type { StreamingConfig } from "@/components/hooks/useStreamingForm";

interface AddStreamingFormProps<T extends StreamingConfig> {
  open: boolean;
  onClose: () => void;
  onAdd: (config: Omit<T, 'id' | 'guildId'>) => Promise<boolean>;
  channelNameField: string;
  channelNameLabel: string;
  channelNamePlaceholder: string;
  guildId: string;
  moduleName: string;
  moduleColor: string;
  channels: { id: string; name: string }[];
  loadingChannels: boolean;
  saving: boolean;
}

export default function AddStreamingDialog<T extends StreamingConfig>({
  open,
  onClose,
  onAdd,
  channelNameField,
  channelNameLabel,
  channelNamePlaceholder,
  guildId,
  moduleName,
  moduleColor,
  channels,
  loadingChannels,
  saving
}: AddStreamingFormProps<T>) {
  const {
    newConfig,
    handleAddConfig,
    handleChannelChange,
    handleChannelNameChange,
    handleCustomMessageChange
  } = useStreamingForm<T>({
    onAdd,
    onUpdate: async () => false,
    onDelete: async () => false,
    channelNameField,
    guildId
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'grey.800',
          border: 1,
          borderColor: 'grey.700'
        }
      }}
    >
      <DialogTitle sx={{ color: 'grey.100' }}>
        Add {moduleName} {moduleName === 'YouTube' ? 'Channel' : 'Streamer'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField
            fullWidth
            label={channelNameLabel}
            placeholder={channelNamePlaceholder}
            value={newConfig[channelNameField]}
            onChange={(e) => handleChannelNameChange(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiInputLabel-root': { color: 'grey.300' },
              '& .MuiOutlinedInput-root': {
                color: 'grey.100',
                '& fieldset': { borderColor: 'grey.600' },
                '&:hover fieldset': { borderColor: 'grey.500' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' }
              }
            }}
            helperText={`Enter the ${moduleName} ${channelNameLabel.toLowerCase()}`}
            FormHelperTextProps={{ sx: { color: 'grey.400' } }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: 'grey.300' }}>Discord Channel</InputLabel>
            <Select
              value={newConfig.discordChannelId}
              label="Discord Channel"
              onChange={(e) => handleChannelChange(e)}
              disabled={loadingChannels}
              sx={{
                color: 'grey.100',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.600' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.500' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: 'grey.800',
                    border: 1,
                    borderColor: 'grey.700',
                    '& .MuiMenuItem-root': {
                      color: 'grey.100',
                      '&:hover': { bgcolor: 'grey.700' }
                    }
                  }
                }
              }}
            >
              {loadingChannels ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Loading channels...
                </MenuItem>
              ) : channels.length === 0 ? (
                <MenuItem disabled>No channels available</MenuItem>
              ) : (
                channels.map((channel) => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Custom Message (Optional)"
            placeholder={moduleName === 'YouTube' ? "New video from {channel}!" : "{streamer} is now live!"}
            value={newConfig.customMessage}
            onChange={(e) => handleCustomMessageChange(e.target.value)}
            sx={{
              '& .MuiInputLabel-root': { color: 'grey.300' },
              '& .MuiOutlinedInput-root': {
                color: 'grey.100',
                '& fieldset': { borderColor: 'grey.600' },
                '&:hover fieldset': { borderColor: 'grey.500' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' }
              }
            }}
            helperText="Optional custom message for notifications"
            FormHelperTextProps={{ sx: { color: 'grey.400' } }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{ color: 'grey.300' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAddConfig}
          variant="contained"
          disabled={saving || !newConfig[channelNameField] || !newConfig.discordChannelId}
          sx={{
            bgcolor: moduleColor,
            '&:hover': { bgcolor: moduleColor, filter: 'brightness(0.9)' }
          }}
        >
          {saving ? <CircularProgress size={20} /> : `Add ${moduleName === 'YouTube' ? 'Channel' : 'Streamer'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
