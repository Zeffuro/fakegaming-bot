import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  CircularProgress,
  Autocomplete
} from "@mui/material";
import { StreamingConfig } from "@/components/hooks/useStreamingForm";

interface EditStreamingDialogProps<T extends StreamingConfig> {
  open: boolean;
  onClose: () => void;
  config: T | null;
  onConfigChange: (field: string, value: any) => void;
  onSave: () => Promise<boolean>;
  channelNameField: string;
  channelNameLabel: string;
  moduleName: string;
  moduleColor: string;
  channels: { id: string; name: string }[];
  loadingChannels: boolean;
  saving: boolean;
}

export default function EditStreamingDialog<T extends StreamingConfig>({
  open,
  onClose,
  config,
  onConfigChange,
  onSave,
  channelNameField,
  channelNameLabel,
  moduleName,
  moduleColor,
  channels,
  loadingChannels,
  saving
}: EditStreamingDialogProps<T>) {
  if (!config) return null;

  const selectedChannel = channels.find(ch => ch.id === config.discordChannelId) || null;

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
        Edit {moduleName} {moduleName === 'YouTube' ? 'Channel' : 'Streamer'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField
            fullWidth
            label={channelNameLabel}
            value={config[channelNameField as keyof T] as string}
            onChange={(e) => onConfigChange(channelNameField, e.target.value)}
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
            slotProps={{
              formHelperText: { sx: { color: 'grey.400' } }
            }}
          />

          <Autocomplete
            fullWidth
            options={channels}
            getOptionLabel={(option) => `#${option.name}`}
            value={selectedChannel}
            onChange={(event, newValue) => {
              onConfigChange('discordChannelId', newValue?.id || '');
            }}
            loading={loadingChannels}
            disabled={loadingChannels}
            slots={{
              paper: ({ children, ...other }) => (
                <div
                  {...other}
                  style={{
                    backgroundColor: 'rgb(66, 66, 66)',
                    border: '1px solid rgb(97, 97, 97)',
                    borderRadius: '4px',
                    ...other.style
                  }}
                >
                  {children}
                </div>
              )
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Discord Channel"
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
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingChannels ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }
                }}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <li
                  key={key}
                  {...otherProps}
                  style={{
                    backgroundColor: 'rgb(66, 66, 66)',
                    color: 'rgb(245, 245, 245)',
                    padding: '8px 16px',
                  }}
                >
                  #{option.name}
                </li>
              );
            }}
            noOptionsText={loadingChannels ? "Loading channels..." : "No channels available"}
            sx={{
              '& .MuiAutocomplete-popupIndicator': { color: 'grey.400' },
              '& .MuiAutocomplete-clearIndicator': { color: 'grey.400' }
            }}
          />

          <TextField
            fullWidth
            label="Custom Message (Optional)"
            value={config.customMessage || ''}
            onChange={(e) => onConfigChange('customMessage', e.target.value)}
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
            slotProps={{
              formHelperText: { sx: { color: 'grey.400' } }
            }}
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
          onClick={onSave}
          variant="contained"
          disabled={saving}
          sx={{
            bgcolor: moduleColor,
            '&:hover': { bgcolor: moduleColor, filter: 'brightness(0.9)' }
          }}
        >
          {saving ? <CircularProgress size={20} /> : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
