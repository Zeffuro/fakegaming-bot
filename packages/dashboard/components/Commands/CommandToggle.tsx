import React from "react";
import { Switch, Typography, Box, Chip } from "@mui/material";

interface CommandToggleProps {
  name: string;
  description: string;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  loading?: boolean;
  interactiveDisabled?: boolean;
}

const CommandToggle: React.FC<CommandToggleProps> = ({ name, description, disabled, onToggle, loading, interactiveDisabled }) => (
  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
    <Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="subtitle1">{name}</Typography>
        {interactiveDisabled ? (
          <Chip size="small" color="warning" variant="outlined" label="Module disabled" />
        ) : null}
      </Box>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </Box>
    <Switch
      checked={!disabled}
      onChange={e => onToggle(e.target.checked)}
      disabled={!!loading || !!interactiveDisabled}
      slotProps={{ input: { "aria-label": `Enable/disable ${name}` } }}
    />
  </Box>
);

export default CommandToggle;
