import React from "react";
import { Switch, Typography, Box, Chip } from "@mui/material";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";

interface CommandToggleProps {
  name: string;
  description: string;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  loading?: boolean;
  interactiveDisabled?: boolean;
}

const CommandToggle: React.FC<CommandToggleProps> = ({ name, description, disabled, onToggle, loading, interactiveDisabled }) => (
  <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 2, mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
    <Box>
      <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
        <Typography variant="subtitle1" sx={{ color: "grey.50", fontWeight: 800 }}>{name}</Typography>
        {interactiveDisabled ? (
          <Chip size="small" color="warning" variant="outlined" label="Module disabled" />
        ) : null}
      </Box>
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>{description}</Typography>
    </Box>
    <Switch
      checked={!disabled}
      onChange={e => onToggle(e.target.checked)}
      disabled={!!loading || !!interactiveDisabled}
      sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: dashboardAccents.commands } }}
      slotProps={{ input: { "aria-label": `Enable/disable ${name}` } }}
    />
  </Box>
);

export default CommandToggle;
