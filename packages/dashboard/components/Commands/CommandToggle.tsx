import React from "react";
import { Switch, Typography, Box } from "@mui/material";

interface CommandToggleProps {
  name: string;
  description: string;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  loading?: boolean;
}

const CommandToggle: React.FC<CommandToggleProps> = ({ name, description, disabled, onToggle, loading }) => (
  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
    <Box>
      <Typography variant="subtitle1">{name}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </Box>
    <Switch
      checked={!disabled}
      onChange={e => onToggle(e.target.checked)}
      disabled={loading}
      inputProps={{ "aria-label": `Enable/disable ${name}` }}
    />
  </Box>
);

export default CommandToggle;

