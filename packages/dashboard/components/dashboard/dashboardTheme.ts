import { alpha } from "@mui/material/styles";

export type DashboardSx = Record<string, unknown>;

export const dashboardAccents = {
  twitch: "#9146FF",
  tiktok: "#00F2EA",
  bluesky: "#1185FE",
  youtube: "#FF3B30",
  patchNotes: "#8B5CF6",
  anime: "#02A9FF",
  birthdays: "#FFC857",
  quotes: "#FF6B9A",
  commands: "#68D7FF",
  settings: "#A3E635",
  admin: "#F97316",
  neutral: "#94A3B8",
} as const;

export type DashboardAccentKey = keyof typeof dashboardAccents;

export const dashboardShellSx = (
  accent: string = dashboardAccents.neutral,
  secondaryAccent: string = accent,
): DashboardSx => ({
  position: "relative",
  isolation: "isolate",
  "&::before": {
    content: '""',
    position: "fixed",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
    background: [
      `radial-gradient(circle at 18% 8%, ${alpha(accent, 0.18)}, transparent 34%)`,
      `radial-gradient(circle at 88% 20%, ${alpha(secondaryAccent, 0.12)}, transparent 32%)`,
      "linear-gradient(180deg, rgba(15,23,42,0.18), transparent 34%)",
    ].join(", "),
  },
});

export const dashboardPanelSx = (accent: string = dashboardAccents.neutral): DashboardSx => ({
  position: "relative",
  overflow: "hidden",
  borderRadius: 4,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(145deg, rgba(18,24,34,0.96), rgba(8,13,22,0.94))",
  boxShadow: "0 24px 70px rgba(0,0,0,0.34)",
  backdropFilter: "blur(14px)",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    borderRadius: "inherit",
    background: `linear-gradient(135deg, ${alpha(accent, 0.14)}, transparent 44%)`,
  },
});

export const dashboardCardSx = (accent: string = dashboardAccents.neutral): DashboardSx => ({
  height: "100%",
  borderRadius: 3,
  bgcolor: "rgba(8,13,22,0.76)",
  border: "1px solid rgba(255,255,255,0.08)",
  transition: "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
  "&:hover": {
    transform: "translateY(-2px)",
    borderColor: alpha(accent, 0.45),
    boxShadow: `0 18px 46px ${alpha(accent, 0.16)}`,
  },
});

export const dashboardFieldSx = (accent: string = dashboardAccents.neutral): DashboardSx => ({
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.62)" },
  "& .MuiInputLabel-root.Mui-focused": { color: accent },
  "& .MuiOutlinedInput-root": {
    color: "grey.100",
    bgcolor: "rgba(255,255,255,0.045)",
    borderRadius: 2,
    "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
    "&:hover fieldset": { borderColor: alpha(accent, 0.45) },
    "&.Mui-focused fieldset": { borderColor: accent },
  },
  "& .MuiFormHelperText-root": { color: "rgba(255,255,255,0.48)" },
  "& .MuiAutocomplete-popupIndicator": { color: "rgba(255,255,255,0.58)" },
  "& .MuiAutocomplete-clearIndicator": { color: "rgba(255,255,255,0.58)" },
});

export const primaryActionButtonSx = (accent: string = dashboardAccents.neutral): DashboardSx => ({
  borderRadius: 999,
  textTransform: "none",
  fontWeight: 800,
  bgcolor: accent,
  boxShadow: `0 12px 30px ${alpha(accent, 0.24)}`,
  "&:hover": { bgcolor: accent, filter: "brightness(0.93)", boxShadow: `0 16px 38px ${alpha(accent, 0.30)}` },
});

export const ghostActionButtonSx = (accent: string = dashboardAccents.neutral): DashboardSx => ({
  borderRadius: 999,
  textTransform: "none",
  color: "grey.100",
  borderColor: "rgba(255,255,255,0.16)",
  "&:hover": { borderColor: alpha(accent, 0.72), bgcolor: alpha(accent, 0.10) },
});

export const dangerActionButtonSx: DashboardSx = {
  borderRadius: 999,
  textTransform: "none",
  borderColor: "rgba(255,107,154,0.35)",
  color: dashboardAccents.quotes,
  "&:hover": { borderColor: dashboardAccents.quotes, bgcolor: "rgba(255,107,154,0.10)" },
};

export const dashboardDialogPaperSx = (accent: string = dashboardAccents.neutral): DashboardSx => ({
  bgcolor: "rgba(18,24,34,0.98)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 4,
  boxShadow: `0 28px 80px rgba(0,0,0,0.50), 0 0 0 1px ${alpha(accent, 0.08)}`,
});
